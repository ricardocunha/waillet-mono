package validator

import (
	"regexp"
	"strings"
)

var ethAddressRegex = regexp.MustCompile("^0x[a-fA-F0-9]{40}$")

func IsValidEthereumAddress(address string) bool {
	return ethAddressRegex.MatchString(address)
}

func NormalizeAddress(address string) string {
	return strings.ToLower(address)
}

func PadAddress(address string) string {
	if strings.HasPrefix(address, "0x") {
		address = address[2:]
	}
	for len(address) < 40 {
		address = "0" + address
	}
	return "0x" + address
}

func IsValidTxHash(hash string) bool {
	if !strings.HasPrefix(hash, "0x") {
		return false
	}
	if len(hash) != 66 {
		return false
	}
	return regexp.MustCompile("^0x[a-fA-F0-9]{64}$").MatchString(hash)
}

func IsHexData(data string) bool {
	if data == "" || data == "0x" {
		return true
	}
	if !strings.HasPrefix(data, "0x") {
		return false
	}
	return regexp.MustCompile("^0x[a-fA-F0-9]*$").MatchString(data)
}
