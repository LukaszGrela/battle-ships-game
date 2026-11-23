import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { useCallback, useEffect } from "react";
import { RestoredToast } from "../RestoredToast";
import { useConnectionStatus } from "../../../store/useConnectionStatus";
import { Button } from "../../Button";

/**
 * The toast renders itself only while `restoredAt` is set, so stories seed
 * the connection store and reset it on unmount.
 */
const ToastState = ({
  restored,
  children,
}: {
  restored: boolean;
  children: ReactNode;
}) => {
  useEffect(() => {
    useConnectionStatus.setState({
      connected: true,
      phase: restored ? "connected" : "idle",
      restoredAt: restored ? Date.now() : undefined,
    });

    return () => {
      useConnectionStatus.setState({
        connected: false,
        phase: "idle",
        restoredAt: undefined,
      });
    };
  }, [restored]);

  const showToast = useCallback(() => {
    useConnectionStatus.setState({
      connected: true,
      phase: restored ? "connected" : "idle",
      restoredAt: restored ? Date.now() : undefined,
    });
  }, [restored]);

  return (
    <div style={{ minHeight: "240px" }}>
      <Button onClick={showToast}>Show toast</Button>
      {children}
    </div>
  );
};

const meta = {
  title: "components/RestoredToast",
  component: RestoredToast,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof RestoredToast>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * **Note:** the toast hides itself after 6 s (the real auto-dismiss timer runs
 * in Storybook too).
 */
export const Restored: Story = {
  render: () => (
    <ToastState restored>
      <RestoredToast />
    </ToastState>
  ),
};
