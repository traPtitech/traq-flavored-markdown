package worker

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

func digestFile(file string) (string, error) {
	handle, err := os.Open(file)
	if err != nil {
		return "", err
	}
	defer handle.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, handle); err != nil {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func RunFiles(plan ComparisonPlan, before, after Adapter, initialization Initialization) (result ProfileResult, err error) {
	digest, err := digestFile(plan.Corpus)
	if err != nil {
		return result, err
	}
	if digest != plan.CorpusSHA256 {
		return result, fmt.Errorf("corpus digest mismatch")
	}
	output, err := os.OpenFile(filepath.Join(plan.Output, "plain-text-differences.jsonl"), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return result, err
	}
	closed := false
	defer func() {
		if !closed {
			err = errors.Join(err, output.Close())
		}
	}()
	writer := bufio.NewWriterSize(output, 1<<20)
	encoder := json.NewEncoder(writer)
	encoder.SetEscapeHTML(false)
	result, err = Compare(func() (io.ReadCloser, error) { return os.Open(plan.Corpus) }, Options{RunID: plan.RunID, Max: plan.Max, Warmups: plan.Warmups, Before: before, After: after}, func(row DifferenceRow) error { return encoder.Encode(row) })
	if err != nil {
		return result, err
	}
	if err = writer.Flush(); err != nil {
		return result, err
	}
	err = output.Close()
	closed = true
	if err != nil {
		return result, err
	}
	result.Initialization = initialization
	summary := WorkerResults{RunID: plan.RunID, CorpusSHA256: plan.CorpusSHA256, Results: map[string]ProfileResult{"plainText": result}}
	data, err := json.MarshalIndent(summary, "", "  ")
	if err != nil {
		return result, err
	}
	if err = Validate("results", data); err != nil {
		return result, err
	}
	summaryFile, err := os.OpenFile(filepath.Join(plan.Output, "plain-text-results.json"), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return result, err
	}
	_, writeErr := summaryFile.Write(append(data, '\n'))
	return result, errors.Join(writeErr, summaryFile.Close())
}
