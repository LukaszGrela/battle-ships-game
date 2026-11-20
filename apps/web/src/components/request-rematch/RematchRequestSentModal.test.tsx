import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { TRematchRequest } from "@repo/types";

const { socketMock } = vi.hoisted(() => ({
  socketMock: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

vi.mock("../../socket", () => ({
  socket: socketMock,
}));

vi.mock("../Modal", () => ({
  Modal: ({
    open,
    children,
    footer,
    onClose,
  }: {
    open?: boolean;
    children?: ReactNode;
    footer?: (open: boolean, onClose: () => void) => ReactNode;
    onClose?: () => void;
  }) =>
    open ? (
      <div data-testid="rematch-modal">
        {children}
        {footer?.(open, () => onClose?.())}
      </div>
    ) : null,
}));

vi.mock("../Waves", () => ({
  Waves: () => <div data-testid="waves" />,
}));

vi.mock("../DotLoader", () => ({
  DotLoader: ({ label }: { label?: string }) => (
    <div role="status">{label}</div>
  ),
}));

import { RematchRequestSentModal } from "./RematchRequestSentModal";

const createRequest = (
  overrides: Partial<TRematchRequest> = {},
): TRematchRequest => ({
  requestId: "00000000-0000-4000-8000-000000000001",
  requestorId: "player-1",
  name: "Captain Black",
  seed: 42,
  status: "pending",
  ...overrides,
});

describe("RematchRequestSentModal", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("shows the request timer for a pending request", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    render(
      <RematchRequestSentModal
        open
        request={createRequest({
          expiresAt: "2026-01-01T00:01:05.000Z",
        })}
      />,
    );

    expect(screen.getByText("Request expires in 65s")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel request" }),
    ).toBeEnabled();
  });

  it("does not show a timer when the request has no expiry", () => {
    render(<RematchRequestSentModal open request={createRequest()} />);

    expect(screen.queryByText(/Request expires in/)).not.toBeInTheDocument();
  });

  it("counts down the remaining seconds every second", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    render(
      <RematchRequestSentModal
        open
        request={createRequest({
          expiresAt: "2026-01-01T00:01:05.000Z",
        })}
      />,
    );

    expect(screen.getByText("Request expires in 65s")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.getByText("Request expires in 60s")).toBeInTheDocument();
  });

  it("emits cancel_rematch once and disables the button while cancelling", () => {
    render(<RematchRequestSentModal open request={createRequest()} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));

    expect(socketMock.emit).toHaveBeenCalledTimes(1);
    expect(socketMock.emit).toHaveBeenCalledWith("cancel_rematch");
    expect(screen.getByRole("button", { name: "Cancelling…" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Cancelling…" }));

    expect(socketMock.emit).toHaveBeenCalledTimes(1);
  });

  it("informs the user when the request timed out", () => {
    render(
      <RematchRequestSentModal
        open
        request={createRequest({
          status: "cancelled",
          cancelledReason: "timeout",
        })}
      />,
    );

    expect(
      screen.getByText("The rematch request timed out and was cancelled."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "You cannot send another rematch request for this game.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel request" }),
    ).not.toBeInTheDocument();
  });

  it("informs the user when they cancelled the request", () => {
    render(
      <RematchRequestSentModal
        open
        request={createRequest({
          status: "cancelled",
          cancelledReason: "cancelled",
        })}
      />,
    );

    expect(
      screen.getByText("You cancelled the rematch request."),
    ).toBeInTheDocument();
  });

  it("switches from pending to cancellation without keeping stale state", () => {
    const { rerender } = render(
      <RematchRequestSentModal open request={createRequest()} />,
    );

    expect(
      screen.getByRole("button", { name: "Cancel request" }),
    ).toBeInTheDocument();

    rerender(
      <RematchRequestSentModal
        open
        request={createRequest({
          status: "cancelled",
          cancelledReason: "timeout",
        })}
      />,
    );

    expect(
      screen.getByText("The rematch request timed out and was cancelled."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel request" }),
    ).not.toBeInTheDocument();
  });

  it("closes the cancellation message", () => {
    render(
      <RematchRequestSentModal
        open
        request={createRequest({
          status: "cancelled",
          cancelledReason: "cancelled",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByTestId("rematch-modal")).not.toBeInTheDocument();
  });

  it("shows a new pending request after a cancellation was dismissed", () => {
    const { rerender } = render(
      <RematchRequestSentModal
        open
        request={createRequest({
          status: "cancelled",
          cancelledReason: "timeout",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("rematch-modal")).not.toBeInTheDocument();

    rerender(
      <RematchRequestSentModal
        open
        request={createRequest({
          requestId: "00000000-0000-4000-8000-000000000002",
          requestorId: "player-2",
          seed: 77,
        })}
      />,
    );

    expect(screen.getByTestId("rematch-modal")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel request" }),
    ).toBeEnabled();
    expect(
      screen.queryByText("The rematch request timed out and was cancelled."),
    ).not.toBeInTheDocument();
  });

  it("re-enables the Cancel button when cancellation fails", () => {
    render(<RematchRequestSentModal open request={createRequest()} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));
    expect(screen.getByRole("button", { name: "Cancelling…" })).toBeDisabled();

    const errorCall = socketMock.on.mock.calls.find(
      ([event]) => event === "error",
    );
    const handleError = errorCall?.[1] as (() => void) | undefined;

    act(() => {
      handleError?.();
    });

    expect(
      screen.getByRole("button", { name: "Cancel request" }),
    ).toBeEnabled();
  });

  it("re-enables the Cancel button when the acknowledgement is lost", () => {
    vi.useFakeTimers();
    render(<RematchRequestSentModal open request={createRequest()} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));
    expect(screen.getByRole("button", { name: "Cancelling…" })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(
      screen.getByRole("button", { name: "Cancel request" }),
    ).toBeEnabled();
  });

  it("resets cancelling when a different pending request arrives", () => {
    const { rerender } = render(
      <RematchRequestSentModal open request={createRequest()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));
    expect(screen.getByRole("button", { name: "Cancelling…" })).toBeDisabled();

    rerender(
      <RematchRequestSentModal
        open
        request={createRequest({
          requestId: "00000000-0000-4000-8000-000000000002",
          requestorId: "player-2",
          seed: 77,
        })}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Cancel request" }),
    ).toBeEnabled();
  });

  it("keeps cancelling across a re-broadcast of the same pending request", () => {
    const { rerender } = render(
      <RematchRequestSentModal open request={createRequest()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));
    expect(screen.getByRole("button", { name: "Cancelling…" })).toBeDisabled();

    // Socket broadcasts deserialize into a new object for the same request.
    rerender(<RematchRequestSentModal open request={createRequest()} />);

    expect(screen.getByRole("button", { name: "Cancelling…" })).toBeDisabled();
    expect(socketMock.emit).toHaveBeenCalledTimes(1);
  });

  it("keeps the cancellation dismissed after the same request is re-broadcast", () => {
    const cancelled = {
      status: "cancelled" as const,
      cancelledReason: "timeout" as const,
    };
    const { rerender } = render(
      <RematchRequestSentModal open request={createRequest(cancelled)} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("rematch-modal")).not.toBeInTheDocument();

    rerender(
      <RematchRequestSentModal open request={createRequest(cancelled)} />,
    );

    expect(screen.queryByTestId("rematch-modal")).not.toBeInTheDocument();
  });
});
