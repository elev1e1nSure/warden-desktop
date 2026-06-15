import type { StatusResult } from "../api/types";
import type { Model } from "../types";
import ModelSelector from "./ModelSelector";

interface StatusBarProps {
  status: StatusResult | null;
  connected: boolean;
  models: string[];
  onSelectModel: (name: string) => void;
  onOpenConnect: () => void;
}

export default function StatusBar({
  status,
  connected,
  models,
  onSelectModel,
  onOpenConnect,
}: StatusBarProps) {
  const modelList: Model[] = models.map((m) => ({
    id: m,
    name: m,
    description: "",
  }));
  const selected: Model = {
    id: status?.model ?? "",
    name: status?.model || "No model",
    description: "",
  };

  return (
    <div className="flex items-center border-t border-hairline px-4 py-2.5">
      {connected ? (
        <ModelSelector
          models={modelList}
          selected={selected}
          onSelect={(m) => onSelectModel(m.id)}
        />
      ) : (
        <button
          type="button"
          onClick={onOpenConnect}
          className="rounded-full border border-line bg-fill-subtle px-3 py-1 text-meta font-medium text-text-secondary transition-colors hover:border-fill-strong hover:text-text-primary"
        >
          Connect a model
        </button>
      )}
    </div>
  );
}
