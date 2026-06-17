import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ConnectModal from "../components/ConnectModal";

const { connectMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
}));

vi.mock("../api/client", () => ({
  api: {
    connect: connectMock,
  },
}));

describe("ConnectModal", () => {
  beforeEach(() => {
    connectMock.mockReset();
  });

  test("connects after StrictMode remount", async () => {
    connectMock.mockResolvedValue({ ok: true });
    const onConnected = vi.fn();

    render(
      <StrictMode>
        <ConnectModal onConnected={onConnected} />
      </StrictMode>,
    );

    await userEvent.type(screen.getByPlaceholderText("sk-or-v1-..."), "sk-or-v1-test");
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => expect(onConnected).toHaveBeenCalledTimes(1));
    expect(connectMock).toHaveBeenCalledWith("sk-or-v1-test");
  });
});
