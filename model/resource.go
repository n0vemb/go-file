package model

import (
	"github.com/jinzhu/gorm"
	"go-file/common"
	"os"
	"path/filepath"
	"strings"
)

type Resource struct {
	Id              int    `json:"id"`
	Type            string `json:"type"`
	Filename        string `json:"filename"`
	Description     string `json:"description"`
	Uploader        string `json:"uploader"`
	Link            string `json:"link" gorm:"unique"`
	Size            int64  `json:"size"`
	Time            string `json:"time"`
	Tags            string `json:"tags"`
	DownloadCounter int    `json:"download_counter"`
}

func AllResources() ([]*Resource, error) {
	var resources []*Resource
	var err error
	err = DB.Find(&resources).Error
	return resources, err
}

func QueryResources(resourceType string, query string, tag string, sort string, startIdx int, pageSize int) ([]*Resource, error) {
	var resources []*Resource
	db := DB
	if resourceType != "" && resourceType != "all" {
		db = db.Where("type = ?", resourceType)
	}
	if query != "" {
		query = strings.ToLower(query)
		db = db.Where("lower(filename) LIKE ? or lower(description) LIKE ? or lower(uploader) LIKE ? or lower(tags) LIKE ?",
			"%"+query+"%", "%"+query+"%", "%"+query+"%", "%"+query+"%")
	}
	if tag != "" {
		db = db.Where("tags LIKE ?", "%"+tag+"%")
	}
	if sort == "asc" {
		db = db.Order("id asc")
	} else {
		db = db.Order("id desc")
	}
	err := db.Limit(pageSize).Offset(startIdx).Find(&resources).Error
	return resources, err
}

func CountResources(resourceType string, query string, tag string) (int, error) {
	db := DB
	if resourceType != "" && resourceType != "all" {
		db = db.Where("type = ?", resourceType)
	}
	if query != "" {
		query = strings.ToLower(query)
		db = db.Where("lower(filename) LIKE ? or lower(description) LIKE ? or lower(uploader) LIKE ? or lower(tags) LIKE ?",
			"%"+query+"%", "%"+query+"%", "%"+query+"%", "%"+query+"%")
	}
	if tag != "" {
		db = db.Where("tags LIKE ?", "%"+tag+"%")
	}
	var total int
	err := db.Model(&Resource{}).Count(&total).Error
	return total, err
}

func ResourceTypeCounts() (map[string]int, error) {
	counts := map[string]int{
		"all":   0,
		"image": 0,
		"video": 0,
		"audio": 0,
		"file":  0,
	}
	type typeCount struct {
		Type  string
		Count int
	}
	var rows []typeCount
	err := DB.Model(&Resource{}).Select("type, count(*) as count").Group("type").Scan(&rows).Error
	if err != nil {
		return counts, err
	}
	for _, row := range rows {
		if _, ok := counts[row.Type]; ok {
			counts[row.Type] = row.Count
		}
		counts["all"] += row.Count
	}
	return counts, nil
}

func AllTags() ([]string, error) {
	var rows []string
	err := DB.Model(&Resource{}).Where("tags <> ''").Pluck("tags", &rows).Error
	if err != nil {
		return nil, err
	}
	seen := make(map[string]bool)
	var tags []string
	for _, row := range rows {
		for _, part := range strings.Split(row, ",") {
			tag := strings.TrimSpace(part)
			if tag != "" && !seen[tag] {
				seen[tag] = true
				tags = append(tags, tag)
			}
		}
	}
	return tags, nil
}

func (resource *Resource) Insert() error {
	var err error
	err = DB.Create(resource).Error
	return err
}

// Delete removes the resource record and the underlying file.
// Make sure Link is valid! Because we will use os.Remove to delete it!
func (resource *Resource) Delete() error {
	var err error
	err = DB.Delete(resource).Error
	_ = os.Remove(filepath.Join(common.UploadPath, resource.Link))
	return err
}

func UpdateResourceDownloadCounter(link string) {
	DB.Model(&Resource{}).Where("link = ?", link).UpdateColumn("download_counter", gorm.Expr("download_counter + 1"))
}

// ImportLegacyData converts old files and images into unified resources.
func ImportLegacyData() {
	var files []*File
	DB.Find(&files)
	for _, f := range files {
		if f.Link == "" {
			continue
		}
		var count int
		DB.Model(&Resource{}).Where("link = ?", f.Link).Count(&count)
		if count > 0 {
			continue
		}
		size := int64(0)
		if stat, err := os.Stat(filepath.Join(common.UploadPath, f.Link)); err == nil {
			size = stat.Size()
		}
		DB.Create(&Resource{
			Type:            common.GetResourceType(f.Filename),
			Filename:        f.Filename,
			Description:     f.Description,
			Uploader:        f.Uploader,
			Link:            f.Link,
			Size:            size,
			Time:            f.Time,
			DownloadCounter: f.DownloadCounter,
		})
	}
	var images []*Image
	DB.Find(&images)
	for _, im := range images {
		link := "images/" + im.Filename
		var count int
		DB.Model(&Resource{}).Where("link = ?", link).Count(&count)
		if count > 0 {
			continue
		}
		size := int64(0)
		if stat, err := os.Stat(filepath.Join(common.UploadPath, link)); err == nil {
			size = stat.Size()
		}
		DB.Create(&Resource{
			Type:     common.ResourceTypeImage,
			Filename: im.Filename,
			Uploader: im.Uploader,
			Link:     link,
			Size:     size,
			Time:     im.Time,
		})
	}
}
