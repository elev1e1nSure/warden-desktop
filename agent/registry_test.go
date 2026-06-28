package agent

import (
	"testing"

	"github.com/elev1e1nSure/warden/agent/safety"
)

// TestRegistryContracts guards the three things that must stay true for every
// registered tool: it self-describes, its required params actually exist, and a
// safety policy covers it (no silent fall-through to the "unknown tool" default).
func TestRegistryContracts(t *testing.T) {
	reg := Registry()
	if len(reg) == 0 {
		t.Fatal("registry is empty")
	}
	for name, tool := range reg {
		spec := tool.Spec()
		if spec.Description == "" {
			t.Errorf("%s: empty Spec().Description", name)
		}
		for _, req := range spec.Required {
			if _, ok := spec.Params[req]; !ok {
				t.Errorf("%s: required param %q is not declared in Params", name, req)
			}
		}
		dec := safety.AssessToolCall(name, map[string]any{}, ".", "ask")
		if dec.Reason == "unknown tool" {
			t.Errorf("%s: no safety policy (falls through to AssessToolCall default)", name)
		}
	}
}

// TestDefinitionsCoverRegistry ensures every registered tool is advertised to the LLM.
func TestDefinitionsCoverRegistry(t *testing.T) {
	if got, want := len(Definitions()), len(Registry()); got != want {
		t.Errorf("Definitions() has %d entries, registry has %d", got, want)
	}
}
