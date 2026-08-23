package controller

import (
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"go-file/common"
	"go-file/model"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type ResourceDeleteRequest struct {
	Id   int    `json:"id"`
	Link string `json:"link"`
}

func UploadResource(c *gin.Context) {
	uploader := c.GetString("username")
	if uploader == "" {
		uploader = "匿名用户"
	}
	currentTime := time.Now().Format("2006-01-02 15:04:05")
	description := c.PostForm("description")
	tags := c.PostForm("tags")

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": fmt.Sprintf("get form err: %s", err.Error()),
		})
		return
	}
	files := form.File["file"]
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "请选择要上传的文件",
		})
		return
	}
	t := time.Now()
	subfolder := t.Format("2006-01")
	if err := common.MakeDirIfNotExist(filepath.Join(common.UploadPath, subfolder)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	var created []*model.Resource
	for _, file := range files {
		filename := filepath.Base(file.Filename)
		link := fmt.Sprintf("%s/%s", subfolder, filename)
		savePath := filepath.Join(common.UploadPath, subfolder, filename)
		if _, err := os.Stat(savePath); err == nil {
			// File already existed, rename with a timestamp suffix.
			timestamp := t.Format("_2006-01-02_15-04-05")
			ext := filepath.Ext(filename)
			if ext == "" {
				link += timestamp
			} else {
				link = subfolder + "/" + filename[:len(filename)-len(ext)] + timestamp + ext
			}
			savePath = filepath.Join(common.UploadPath, link)
		}
		if err := c.SaveUploadedFile(file, savePath); err != nil {
			common.SysError("failed to save resource: " + err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "保存文件失败：" + err.Error(),
			})
			return
		}
		resource := &model.Resource{
			Type:        common.GetResourceType(filename),
			Filename:    filename,
			Description: description,
			Uploader:    uploader,
			Link:        link,
			Size:        file.Size,
			Time:        currentTime,
			Tags:        tags,
		}
		if err := resource.Insert(); err != nil {
			common.SysError("failed to insert resource to database: " + err.Error())
			continue
		}
		created = append(created, resource)
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    created,
	})
}

func GetResources(c *gin.Context) {
	resourceType := c.Query("type")
	query := c.Query("query")
	tag := c.Query("tag")
	sort := c.Query("sort")
	p, _ := strconv.Atoi(c.DefaultQuery("p", "0"))
	if p < 0 {
		p = 0
	}
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", strconv.Itoa(common.ResourcesPerPage)))
	if pageSize <= 0 || pageSize > 100 {
		pageSize = common.ResourcesPerPage
	}
	startIdx := p * pageSize

	resources, err := model.QueryResources(resourceType, query, tag, sort, startIdx, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	total, err := model.CountResources(resourceType, query, tag)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	counts, err := model.ResourceTypeCounts()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	tags, err := model.AllTags()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"data":     resources,
		"total":    total,
		"counts":   counts,
		"tags":     tags,
		"has_next": startIdx+len(resources) < total,
		"page":     p,
	})
}

func DeleteResource(c *gin.Context) {
	var deleteRequest ResourceDeleteRequest
	if err := json.NewDecoder(c.Request.Body).Decode(&deleteRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	resource := &model.Resource{Id: deleteRequest.Id}
	rowsAffected := model.DB.Where("id = ?", deleteRequest.Id).First(resource).RowsAffected
	if rowsAffected == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "资源不存在！",
		})
		return
	}
	if err := resource.Delete(); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "资源删除成功",
	})
}

func DownloadResource(c *gin.Context) {
	path := c.Param("filepath")
	fullPath := filepath.Join(common.UploadPath, path)
	if !strings.HasPrefix(fullPath, common.UploadPath) {
		// We may being attacked!
		c.Status(http.StatusForbidden)
		return
	}
	go model.UpdateResourceDownloadCounter(strings.TrimPrefix(path, "/"))
	c.File(fullPath)
}
