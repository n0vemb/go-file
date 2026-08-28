/* Go File - unified resource library (Vue 3, no build step) */
(function () {
    if (!window.Vue) return;
    const { createApp, ref, reactive, computed, onMounted, onBeforeUnmount } = Vue;

    const PAGE_SIZE = 24;
    const TYPE_LABELS = {
        image: '图片',
        video: '视频',
        audio: '音频',
        file: '文件',
    };
    const TEXT_EXTS = [
        'txt', 'md', 'markdown', 'json', 'log', 'go', 'py', 'js', 'ts', 'jsx', 'tsx',
        'css', 'scss', 'html', 'htm', 'xml', 'yml', 'yaml', 'c', 'h', 'cpp', 'hpp',
        'sh', 'bash', 'zsh', 'bat', 'cmd', 'ini', 'conf', 'cfg', 'csv', 'tsv', 'sql',
        'toml', 'env', 'gitignore', 'dockerfile', 'properties',
    ];

    function formatSize(bytes) {
        if (bytes == null || bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
        const v = bytes / Math.pow(1024, i);
        return (v >= 100 ? Math.round(v) : v.toFixed(1)) + ' ' + units[i];
    }

    function extOf(name) {
        const m = /\.([^.]+)$/.exec(name || '');
        return m ? m[1].toLowerCase() : '';
    }

    function isTextLike(item) {
        return item.type === 'file' && TEXT_EXTS.includes(extOf(item.filename));
    }

    function resourceUrl(item) {
        return '/resource/' + encodeURI(item.link);
    }

    function icon(name) {
        return window.GFIcon ? window.GFIcon(name) : '';
    }

    function legacyCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try {
            ok = document.execCommand('copy');
        } catch (e) {
            ok = false;
        }
        document.body.removeChild(ta);
        return ok;
    }

    async function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (e) { /* fall through to legacy */ }
        }
        return legacyCopy(text);
    }

    function initTheme() {
        let theme = 'light';
        try {
            theme = localStorage.getItem('gofile-theme') || 'light';
        } catch (e) { /* ignore */ }
        document.documentElement.setAttribute('data-theme', theme);
    }

    window.toggleTheme = function () {
        const html = document.documentElement;
        const dark = html.getAttribute('data-theme') === 'dark';
        html.setAttribute('data-theme', dark ? 'light' : 'dark');
        try {
            localStorage.setItem('gofile-theme', dark ? 'light' : 'dark');
        } catch (e) { /* ignore */ }
    };

    initTheme();

    window.addEventListener('DOMContentLoaded', () => {
        const root = document.getElementById('app');
        if (!root) return;

        // On the unified page, the nav "上传" button opens the Vue upload modal.
        window.showUploadModal = function () {
            window.dispatchEvent(new CustomEvent('open-upload'));
        };

        const app = createApp({
            delimiters: ['${', '}'],
            setup() {
                const state = reactive({
                    list: [],
                    tags: [],
                    total: 0,
                    counts: { all: 0, image: 0, video: 0, audio: 0, file: 0 },
                    page: 0,
                    hasNext: false,
                    loading: true,
                    error: '',
                    type: 'all',
                    queryInput: new URLSearchParams(location.search).get('query') || '',
                    query: new URLSearchParams(location.search).get('query') || '',
                    tag: '',
                    sort: 'desc',
                });

                const upload = reactive({
                    open: false,
                    files: [],
                    description: '',
                    tagsText: '',
                    progress: 0,
                    uploading: false,
                    done: 0,
                    failed: 0,
                    errorMsg: '',
                    lastUploaded: [],
                });

                const preview = reactive({
                    open: false,
                    kind: '',
                    item: null,
                    index: 0,
                    images: [],
                    text: '',
                    textTruncated: false,
                    loadingText: false,
                });

                const qr = reactive({ open: false, link: '', name: '' });
                const del = reactive({ open: false, item: null, items: [], mode: 'single' });
                const selectedIds = reactive({});
                const selectionBox = reactive({ active: false, x1: 0, y1: 0, x2: 0, y2: 0 });
                const directUpload = reactive({ active: false, total: 0, progress: 0, count: 0 });
                const dropActive = ref(false);
                const dragDepth = ref(0);
                const zoneDragging = ref(false);
                const fileInput = ref(null);
                const toasts = reactive([]);
                const canDelete = !!((window.__APP_CONFIG__ || {}).username);

                function toast(msg, type) {
                    const id = Date.now() + Math.random();
                    toasts.push({ id: id, msg: msg, type: type || 'success' });
                    setTimeout(function () {
                        const i = toasts.findIndex(function (t) { return t.id === id; });
                        if (i > -1) toasts.splice(i, 1);
                    }, 3200);
                }

                async function fetchList(append) {
                    state.loading = true;
                    state.error = '';
                    const params = new URLSearchParams();
                    if (state.type !== 'all') params.set('type', state.type);
                    if (state.query) params.set('query', state.query);
                    if (state.tag) params.set('tag', state.tag);
                    params.set('sort', state.sort);
                    if (append) params.set('p', state.page + 1);
                    params.set('page_size', PAGE_SIZE);
                    try {
                        const res = await fetch('/api/resources?' + params.toString());
                        const data = await res.json();
                        if (!data.success) throw new Error(data.message || '加载失败');
                        state.list = append ? state.list.concat(data.data || []) : (data.data || []);
                        state.total = data.total || 0;
                        state.counts = data.counts || state.counts;
                        state.tags = data.tags || [];
                        state.hasNext = !!data.has_next;
                        state.page = data.page || 0;
                    } catch (e) {
                        state.error = e.message;
                        toast(e.message, 'danger');
                    } finally {
                        state.loading = false;
                    }
                }

                function resetAndFetch() {
                    state.page = 0;
                    state.list = [];
                    clearSelection();
                    fetchList(false);
                }

                function setType(t) {
                    if (state.type === t) return;
                    state.type = t;
                    resetAndFetch();
                }

                function applySearch() {
                    state.query = state.queryInput.trim();
                    resetAndFetch();
                }

                function clearSearch() {
                    state.queryInput = '';
                    state.query = '';
                    resetAndFetch();
                }

                function toggleTag(tag) {
                    state.tag = state.tag === tag ? '' : tag;
                    resetAndFetch();
                }

                function loadMore() {
                    if (!state.hasNext || state.loading) return;
                    fetchList(true);
                }

                /* ---------- Upload ---------- */

                function openUpload(files) {
                    upload.open = true;
                    upload.description = '';
                    upload.tagsText = '';
                    upload.progress = 0;
                    upload.uploading = false;
                    upload.done = 0;
                    upload.failed = 0;
                    upload.errorMsg = '';
                    upload.lastUploaded = [];
                    if (files && files.length) addFiles(files);
                }

                function addFiles(fileList) {
                    for (const f of fileList) {
                        if (upload.files.some(function (x) { return x.name === f.name && x.size === f.size; })) continue;
                        upload.files.push(f);
                    }
                }

                function removeFileAt(i) {
                    upload.files.splice(i, 1);
                }

                function onFileInput(e) {
                    addFiles(e.target.files);
                    e.target.value = '';
                }

                function onZoneClick() {
                    if (fileInput.value) fileInput.value.click();
                }

                function onZoneDragEnter() {
                    zoneDragging.value = true;
                }

                function onZoneDragLeave() {
                    zoneDragging.value = false;
                }

                function onZoneDrop(e) {
                    e.preventDefault();
                    zoneDragging.value = false;
                    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                        addFiles(e.dataTransfer.files);
                    }
                }

                function submitUpload() {
                    if (!upload.files.length || upload.uploading) return;
                    upload.uploading = true;
                    upload.progress = 0;
                    upload.done = 0;
                    upload.failed = 0;
                    upload.errorMsg = '';
                    upload.lastUploaded = [];
                    const form = new FormData();
                    for (const f of upload.files) form.append('file', f);
                    if (upload.description.trim()) form.append('description', upload.description.trim());
                    if (upload.tagsText.trim()) form.append('tags', upload.tagsText.trim());
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', '/api/resource');
                    xhr.upload.onprogress = function (e) {
                        if (e.lengthComputable) upload.progress = Math.round((e.loaded / e.total) * 100);
                    };
                    xhr.onload = function () {
                        upload.uploading = false;
                        try {
                            const data = JSON.parse(xhr.responseText);
                            if (data.success) {
                                upload.done = (data.data || []).length;
                                upload.lastUploaded = data.data || [];
                                upload.files = [];
                                upload.open = false;
                                toast('已上传 ' + upload.done + ' 个文件');
                                resetAndFetch();
                            } else {
                                upload.failed = 1;
                                upload.errorMsg = data.message;
                                toast('上传失败：' + data.message, 'danger');
                            }
                        } catch (err) {
                            upload.failed = 1;
                            upload.errorMsg = '服务器返回异常';
                            toast('上传失败', 'danger');
                        }
                    };
                    xhr.onerror = function () {
                        upload.uploading = false;
                        upload.failed = 1;
                        upload.errorMsg = '网络错误，请重试';
                        toast('网络错误，上传失败', 'danger');
                    };
                    xhr.send(form);
                }

                /* ---------- Direct upload (drag & drop, no modal) ---------- */

                function directUploadFiles(files) {
                    const list = Array.from(files);
                    if (!list.length) return;
                    directUpload.active = true;
                    directUpload.total = list.length;
                    directUpload.progress = 0;
                    directUpload.count = 0;
                    const form = new FormData();
                    for (const f of list) form.append('file', f);
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', '/api/resource');
                    xhr.upload.onprogress = function (e) {
                        if (e.lengthComputable) directUpload.progress = Math.round((e.loaded / e.total) * 100);
                    };
                    xhr.onload = function () {
                        directUpload.active = false;
                        try {
                            const data = JSON.parse(xhr.responseText);
                            if (data.success) {
                                directUpload.count = (data.data || []).length;
                                toast('已上传 ' + directUpload.count + ' 个文件');
                            } else {
                                toast('上传失败：' + (data.message || ''), 'danger');
                            }
                        } catch (err) {
                            toast('上传失败', 'danger');
                        }
                        resetAndFetch();
                    };
                    xhr.onerror = function () {
                        directUpload.active = false;
                        toast('网络错误，上传失败', 'danger');
                    };
                    xhr.send(form);
                }

                /* ---------- Preview ---------- */

                function openPreview(item, index) {
                    preview.item = item;
                    preview.index = index;
                    preview.text = '';
                    preview.textTruncated = false;
                    preview.loadingText = false;
                    preview.open = true;
                    preview.images = state.list.filter(function (x) { return x.type === 'image'; });
                    if (item.type === 'image') {
                        preview.kind = 'image';
                    } else if (item.type === 'video') {
                        preview.kind = 'video';
                    } else if (item.type === 'audio') {
                        preview.kind = 'audio';
                    } else if (isTextLike(item)) {
                        preview.kind = 'text';
                        loadText(item);
                    } else {
                        preview.kind = 'file';
                    }
                }

                async function loadText(item) {
                    preview.loadingText = true;
                    try {
                        const res = await fetch(resourceUrl(item));
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        const ct = res.headers.get('content-type') || '';
                        if (!ct.startsWith('text/') && !ct.includes('json') && !ct.includes('xml')) {
                            preview.kind = 'file';
                            return;
                        }
                        let text = await res.text();
                        if (text.length > 200000) {
                            text = text.slice(0, 200000);
                            preview.textTruncated = true;
                        }
                        preview.text = text;
                    } catch (e) {
                        preview.text = '无法加载文本内容：' + e.message;
                    } finally {
                        preview.loadingText = false;
                    }
                }

                function previewImageNav(dir) {
                    if (!preview.images.length) return;
                    let idx = preview.images.findIndex(function (x) { return x.id === preview.item.id; });
                    if (idx < 0) idx = preview.index;
                    idx = (idx + dir + preview.images.length) % preview.images.length;
                    preview.item = preview.images[idx];
                    preview.index = idx;
                }

                /* ---------- QR / copy / delete ---------- */

                function openQR(item) {
                    qr.link = location.origin + resourceUrl(item);
                    qr.name = item.filename;
                    qr.open = true;
                    setTimeout(function () {
                        const canvas = document.getElementById('qr-canvas');
                        if (canvas && window.QRious) {
                            new QRious({ element: canvas, value: qr.link, size: 220, level: 'M' });
                        }
                    }, 60);
                }

                async function copyResourceLink(item) {
                    const link = location.origin + resourceUrl(item);
                    const ok = await copyToClipboard(link);
                    if (ok) {
                        toast('链接已复制到剪贴板');
                    } else {
                        toast('复制失败，请手动复制', 'danger');
                    }
                }

                async function copyQrLink() {
                    const ok = await copyToClipboard(qr.link);
                    if (ok) {
                        toast('链接已复制到剪贴板');
                    } else {
                        toast('复制失败，请手动复制', 'danger');
                    }
                }

                function askDelete(item) {
                    del.mode = 'single';
                    del.item = item;
                    del.items = [item];
                    del.open = true;
                }

                function askBatchDelete() {
                    const items = state.list.filter(function (x) { return !!selectedIds[x.id]; });
                    if (!items.length) return;
                    del.mode = 'batch';
                    del.item = null;
                    del.items = items;
                    del.open = true;
                }

                async function confirmDelete() {
                    const items = del.items || [];
                    if (!items.length) {
                        del.open = false;
                        return;
                    }
                    try {
                        let ok = false;
                        let msg = '';
                        if (del.mode === 'batch') {
                            const res = await fetch('/api/resources', {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    items: items.map(function (i) { return { id: i.id, link: i.link }; }),
                                }),
                            });
                            const data = await res.json();
                            ok = data.success;
                            msg = data.message || '删除成功';
                        } else {
                            const item = items[0];
                            const res = await fetch('/api/resource', {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: item.id, link: item.link }),
                            });
                            const data = await res.json();
                            ok = data.success;
                            msg = data.message || '';
                        }
                        if (ok) {
                            toast(msg || '已删除');
                            clearSelection();
                            resetAndFetch();
                        } else {
                            toast(msg || '删除失败', 'danger');
                        }
                    } catch (e) {
                        toast('删除失败', 'danger');
                    }
                    del.open = false;
                    del.item = null;
                    del.items = [];
                }

                /* ---------- Multi-select & batch delete ---------- */

                const selectedCount = computed(function () {
                    return Object.keys(selectedIds).length;
                });

                const boxStyle = computed(function () {
                    if (!selectionBox.active) return {};
                    const r = normalizedBox();
                    return {
                        left: r.x1 + 'px',
                        top: r.y1 + 'px',
                        width: (r.x2 - r.x1) + 'px',
                        height: (r.y2 - r.y1) + 'px',
                    };
                });

                function normalizedBox() {
                    return {
                        x1: Math.min(selectionBox.x1, selectionBox.x2),
                        y1: Math.min(selectionBox.y1, selectionBox.y2),
                        x2: Math.max(selectionBox.x1, selectionBox.x2),
                        y2: Math.max(selectionBox.y1, selectionBox.y2),
                    };
                }

                function isSelected(item) {
                    return !!selectedIds[item.id];
                }

                function toggleSelect(item) {
                    if (selectedIds[item.id]) {
                        delete selectedIds[item.id];
                    } else {
                        selectedIds[item.id] = true;
                    }
                }

                function clearSelection() {
                    Object.keys(selectedIds).forEach(function (k) { delete selectedIds[k]; });
                    document.querySelectorAll('.resource-card.is-selecting').forEach(function (el) {
                        el.classList.remove('is-selecting');
                    });
                }

                function selectAllVisible() {
                    state.list.forEach(function (item) { selectedIds[item.id] = true; });
                }

                function onCardClick(e, item) {
                    if (e.ctrlKey || e.metaKey || e.shiftKey) {
                        e.preventDefault();
                        toggleSelect(item);
                        return;
                    }
                    openPreview(item, state.list.indexOf(item));
                }

                function onGridMouseDown(e) {
                    if (e.button !== 0) return;
                    if (e.target.closest('.resource-card') || e.target.closest('.resource-actions')) return;
                    selectionBox.active = true;
                    selectionBox.x1 = selectionBox.x2 = e.clientX;
                    selectionBox.y1 = selectionBox.y2 = e.clientY;
                }

                function onGridMouseMove(e) {
                    if (!selectionBox.active) return;
                    selectionBox.x2 = e.clientX;
                    selectionBox.y2 = e.clientY;
                    highlightCardsInBox();
                }

                function onGridMouseUp(e) {
                    if (!selectionBox.active) return;
                    const small = Math.abs(selectionBox.x2 - selectionBox.x1) < 5 &&
                        Math.abs(selectionBox.y2 - selectionBox.y1) < 5;
                    selectionBox.active = false;
                    highlightCardsInBox();
                    if (small) {
                        // 点击空白处：取消选择
                        if (!e.ctrlKey && !e.metaKey) clearSelection();
                        return;
                    }
                    const rect = normalizedBox();
                    document.querySelectorAll('.resource-card').forEach(function (el) {
                        const r = el.getBoundingClientRect();
                        if (rect.x1 < r.right && rect.x2 > r.left && rect.y1 < r.bottom && rect.y2 > r.top) {
                            const id = Number(el.getAttribute('data-id'));
                            if (id) selectedIds[id] = true;
                        }
                    });
                }

                function highlightCardsInBox() {
                    document.querySelectorAll('.resource-card').forEach(function (el) {
                        el.classList.remove('is-selecting');
                    });
                    if (!selectionBox.active) return;
                    const rect = normalizedBox();
                    document.querySelectorAll('.resource-card').forEach(function (el) {
                        const r = el.getBoundingClientRect();
                        if (rect.x1 < r.right && rect.x2 > r.left && rect.y1 < r.bottom && rect.y2 > r.top) {
                            el.classList.add('is-selecting');
                        }
                    });
                }

                /* ---------- Global drag / paste / keyboard ---------- */

                function onDragEnter(e) {
                    const types = Array.from((e.dataTransfer && e.dataTransfer.types) || []);
                    if (types.includes('Files')) {
                        dragDepth.value++;
                        dropActive.value = true;
                    }
                }

                function onDragOver(e) {
                    e.preventDefault();
                    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
                }

                function onDragLeave() {
                    dragDepth.value = Math.max(0, dragDepth.value - 1);
                    if (dragDepth.value === 0) dropActive.value = false;
                }

                function onDrop(e) {
                    e.preventDefault();
                    dragDepth.value = 0;
                    dropActive.value = false;
                    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                        directUploadFiles(e.dataTransfer.files);
                    }
                }

                function onPaste(e) {
                    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length) {
                        openUpload(e.clipboardData.files);
                    }
                }

                function onKeydown(e) {
                    if (e.key === 'Escape') {
                        if (preview.open) preview.open = false;
                        else if (qr.open) qr.open = false;
                        else if (upload.open && !upload.uploading) upload.open = false;
                        else if (del.open) del.open = false;
                    }
                    if (e.key === 'ArrowLeft' && preview.open && preview.kind === 'image') previewImageNav(-1);
                    if (e.key === 'ArrowRight' && preview.open && preview.kind === 'image') previewImageNav(1);
                }

                onMounted(function () {
                    window.addEventListener('open-upload', function () { openUpload(); });
                    window.addEventListener('search-request', function (e) {
                        state.queryInput = (e.detail || '').trim();
                        applySearch();
                    });
                    window.addEventListener('dragenter', onDragEnter);
                    window.addEventListener('dragover', onDragOver);
                    window.addEventListener('dragleave', onDragLeave);
                    window.addEventListener('drop', onDrop);
                    window.addEventListener('paste', onPaste);
                    window.addEventListener('keydown', onKeydown);
                    window.addEventListener('mousemove', onGridMouseMove);
                    window.addEventListener('mouseup', onGridMouseUp);
                    fetchList(false);
                });

                onBeforeUnmount(function () {
                    window.removeEventListener('dragenter', onDragEnter);
                    window.removeEventListener('dragover', onDragOver);
                    window.removeEventListener('dragleave', onDragLeave);
                    window.removeEventListener('drop', onDrop);
                    window.removeEventListener('paste', onPaste);
                    window.removeEventListener('keydown', onKeydown);
                    window.removeEventListener('mousemove', onGridMouseMove);
                    window.removeEventListener('mouseup', onGridMouseUp);
                });

                return {
                    state: state,
                    upload: upload,
                    preview: preview,
                    qr: qr,
                    del: del,
                    directUpload: directUpload,
                    dropActive: dropActive,
                    zoneDragging: zoneDragging,
                    fileInput: fileInput,
                    toasts: toasts,
                    canDelete: canDelete,
                    TYPE_LABELS: TYPE_LABELS,
                    icon: icon,
                    formatSize: formatSize,
                    extOf: extOf,
                    resourceUrl: resourceUrl,
                    selectedCount: selectedCount,
                    boxStyle: boxStyle,
                    isSelected: isSelected,
                    onCardClick: onCardClick,
                    onGridMouseDown: onGridMouseDown,
                    clearSelection: clearSelection,
                    selectAllVisible: selectAllVisible,
                    askBatchDelete: askBatchDelete,
                    setType: setType,
                    applySearch: applySearch,
                    clearSearch: clearSearch,
                    toggleTag: toggleTag,
                    loadMore: loadMore,
                    openUpload: openUpload,
                    onFileInput: onFileInput,
                    onZoneClick: onZoneClick,
                    onZoneDragEnter: onZoneDragEnter,
                    onZoneDragLeave: onZoneDragLeave,
                    onZoneDrop: onZoneDrop,
                    removeFileAt: removeFileAt,
                    submitUpload: submitUpload,
                    openPreview: openPreview,
                    previewImageNav: previewImageNav,
                    openQR: openQR,
                    copyResourceLink: copyResourceLink,
                    copyQrLink: copyQrLink,
                    askDelete: askDelete,
                    confirmDelete: confirmDelete,
                };
            },
        });

        app.mount('#app');
    });
})();
