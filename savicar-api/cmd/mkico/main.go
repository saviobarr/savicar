// mkico writes the embedded application icon as a .ico file to stdout path.
// Usage: go run ./cmd/mkico <output.ico>
package main

import (
	"os"
	"savicar-api/icon"
)

func main() {
	if len(os.Args) < 2 {
		os.Stderr.WriteString("usage: mkico <output.ico>\n")
		os.Exit(1)
	}
	if err := os.WriteFile(os.Args[1], icon.Load(), 0644); err != nil {
		os.Stderr.WriteString(err.Error() + "\n")
		os.Exit(1)
	}
}
