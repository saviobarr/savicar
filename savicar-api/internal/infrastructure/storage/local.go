package storage

import (
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"time"
)

type LocalFileStorage struct {
	basePath string
}

func NewLocalFileStorage(basePath string) *LocalFileStorage {
	return &LocalFileStorage{basePath: basePath}
}

// Save writes the uploaded file to basePath/subdir and returns the full absolute path.
func (s *LocalFileStorage) Save(file *multipart.FileHeader, subdir string) (string, error) {
	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%d%s", time.Now().UnixMilli(), ext)
	destPath := filepath.Join(s.basePath, subdir, filename)
	if err := os.MkdirAll(filepath.Dir(destPath), 0o755); err != nil {
		return "", fmt.Errorf("mkdir: %w", err)
	}

	src, err := file.Open()
	if err != nil {
		return "", fmt.Errorf("open upload: %w", err)
	}
	defer src.Close()

	dst, err := os.Create(destPath)
	if err != nil {
		return "", fmt.Errorf("create file: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return "", fmt.Errorf("write file: %w", err)
	}

	return destPath, nil
}
