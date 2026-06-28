package serviceorderimage

import "mime/multipart"

type FileStorage interface {
	Save(file *multipart.FileHeader, subdir string) (path string, err error)
}
