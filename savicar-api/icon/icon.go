package icon

import (
	"bytes"
	_ "embed"
	"encoding/binary"
	"image"
	"image/color"
	_ "image/jpeg"
	"image/png"
)

//go:embed savicarlogo.jpeg
var logoJPEG []byte

// Load returns ICO bytes (with embedded PNG) suitable for systray.SetIcon.
func Load() []byte {
	img, _, err := image.Decode(bytes.NewReader(logoJPEG))
	if err != nil {
		return nil
	}

	// Crop to the top 58% — the symbol, excluding the text below
	b := img.Bounds()
	cropH := b.Min.Y + (b.Dy() * 58 / 100)
	cropped := cropImage(img, image.Rect(b.Min.X, b.Min.Y, b.Max.X, cropH))

	// Resize to 32x32 (bilinear for better quality)
	resized := resizeBilinear(cropped, 32, 32)

	// Make white/near-white pixels transparent
	removeWhiteBG(resized, 230)

	// Encode as PNG
	var pngBuf bytes.Buffer
	if err := png.Encode(&pngBuf, resized); err != nil {
		return nil
	}
	pngData := pngBuf.Bytes()

	// Wrap PNG in ICO format (modern ICO supports embedded PNG)
	return makeSingleICO(pngData, 32, 32)
}

func cropImage(src image.Image, rect image.Rectangle) image.Image {
	type subImager interface {
		SubImage(r image.Rectangle) image.Image
	}
	if s, ok := src.(subImager); ok {
		return s.SubImage(rect)
	}
	// Fallback: copy pixels
	dst := image.NewRGBA(image.Rect(0, 0, rect.Dx(), rect.Dy()))
	for y := rect.Min.Y; y < rect.Max.Y; y++ {
		for x := rect.Min.X; x < rect.Max.X; x++ {
			dst.Set(x-rect.Min.X, y-rect.Min.Y, src.At(x, y))
		}
	}
	return dst
}

func resizeBilinear(src image.Image, w, h int) *image.RGBA {
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	b := src.Bounds()
	srcW := float64(b.Dx())
	srcH := float64(b.Dy())
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			sx := float64(b.Min.X) + (float64(x)+0.5)*srcW/float64(w) - 0.5
			sy := float64(b.Min.Y) + (float64(y)+0.5)*srcH/float64(h) - 0.5
			x0, y0 := int(sx), int(sy)
			x1, y1 := x0+1, y0+1
			fx, fy := sx-float64(x0), sy-float64(y0)
			c00 := toRGBAf(src.At(clamp(x0, b.Min.X, b.Max.X-1), clamp(y0, b.Min.Y, b.Max.Y-1)))
			c10 := toRGBAf(src.At(clamp(x1, b.Min.X, b.Max.X-1), clamp(y0, b.Min.Y, b.Max.Y-1)))
			c01 := toRGBAf(src.At(clamp(x0, b.Min.X, b.Max.X-1), clamp(y1, b.Min.Y, b.Max.Y-1)))
			c11 := toRGBAf(src.At(clamp(x1, b.Min.X, b.Max.X-1), clamp(y1, b.Min.Y, b.Max.Y-1)))
			dst.SetRGBA(x, y, color.RGBA{
				R: uint8(c00[0]*(1-fx)*(1-fy) + c10[0]*fx*(1-fy) + c01[0]*(1-fx)*fy + c11[0]*fx*fy),
				G: uint8(c00[1]*(1-fx)*(1-fy) + c10[1]*fx*(1-fy) + c01[1]*(1-fx)*fy + c11[1]*fx*fy),
				B: uint8(c00[2]*(1-fx)*(1-fy) + c10[2]*fx*(1-fy) + c01[2]*(1-fx)*fy + c11[2]*fx*fy),
				A: 255,
			})
		}
	}
	return dst
}

func toRGBAf(c color.Color) [4]float64 {
	r, g, b, a := c.RGBA()
	return [4]float64{float64(r >> 8), float64(g >> 8), float64(b >> 8), float64(a >> 8)}
}

func clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func removeWhiteBG(img *image.RGBA, threshold uint8) {
	b := img.Bounds()
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			c := img.RGBAAt(x, y)
			if c.R >= threshold && c.G >= threshold && c.B >= threshold {
				img.SetRGBA(x, y, color.RGBA{})
			}
		}
	}
}

// makeSingleICO wraps PNG data in a minimal ICO container.
func makeSingleICO(pngData []byte, w, h int) []byte {
	var buf bytes.Buffer

	// ICONDIR header (6 bytes)
	buf.Write([]byte{0, 0}) // reserved
	buf.Write([]byte{1, 0}) // type = 1 (ICO)
	buf.Write([]byte{1, 0}) // count = 1

	// ICONDIRENTRY (16 bytes)
	buf.WriteByte(byte(w))            // width
	buf.WriteByte(byte(h))            // height
	buf.WriteByte(0)                   // color count
	buf.WriteByte(0)                   // reserved
	binary.Write(&buf, binary.LittleEndian, uint16(1))  // planes
	binary.Write(&buf, binary.LittleEndian, uint16(32)) // bit count
	binary.Write(&buf, binary.LittleEndian, uint32(len(pngData))) // size
	binary.Write(&buf, binary.LittleEndian, uint32(6+16))         // offset = header + dir entry

	buf.Write(pngData)
	return buf.Bytes()
}
