import { Toaster as Sonner, type ToasterProps } from "sonner";

export default function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      visibleToasts={4}
      toastOptions={{
        style: {
          padding: "1rem 0.8rem",
          alignItems: "start",
          boxShadow: "0 8px 24px rgba(0,0,0,0.24)",
          userSelect: "none",
        },
      }}
      {...props}
    />
  );
}

export { toast } from "sonner";
