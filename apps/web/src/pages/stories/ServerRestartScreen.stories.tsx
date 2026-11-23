import type { IServerRestartNotice } from "@repo/types";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { expect } from "storybook/test";
import { useConnectionStatus } from "../../store/useConnectionStatus";
import { ServerRestartScreen } from "../ServerRestartScreen";

/**
 * The screen reads the notice from the connection store, so every story
 * seeds that store and resets it on unmount.
 */
const PortScreenState = ({
  notice,
  elapsedMs,
  children,
}: {
  notice?: IServerRestartNotice;
  elapsedMs: number;
  children: ReactNode;
}) => {
  useEffect(() => {
    useConnectionStatus.setState({
      connected: false,
      phase: notice ? "server-restarting" : "idle",
      restartNotice: notice,
      restartAt: notice ? Date.now() - elapsedMs : undefined,
    });

    return () => {
      useConnectionStatus.setState({
        connected: false,
        phase: "idle",
        restartNotice: undefined,
        restartAt: undefined,
      });
    };
  }, [notice, elapsedMs]);

  return <>{children}</>;
};

const meta = {
  title: "pages/ServerRestartScreen",
  component: ServerRestartScreen,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ServerRestartScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderPort = (notice?: IServerRestartNotice, elapsedMs = 0) =>
  function Render() {
    return (
      <PortScreenState notice={notice} elapsedMs={elapsedMs}>
        <div id="root">
          <ServerRestartScreen />
        </div>
      </PortScreenState>
    );
  };

export const RestartCounting: Story = {
  name: "Restart — countdown",
  render: renderPort({ reason: "restart", graceMs: 10_000 }, 1_500),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: /the ship is entering port/i }),
    ).toBeVisible();
    await expect(canvas.getByText(/your game is saved/i)).toBeVisible();
    await expect(canvas.getByText(/back on deck in \d+s/i)).toBeVisible();
    await expect(canvas.getByRole("progressbar")).toBeVisible();
  },
};

export const RestartWaiting: Story = {
  name: "Restart — waiting for the port",
  render: renderPort({ reason: "restart", graceMs: 10_000 }, 12_000),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: /the ship is entering port/i }),
    ).toBeVisible();
    await expect(
      canvas.getByText(/furling the sails and trying to reconnect/i),
    ).toBeVisible();
    await expect(canvas.queryByRole("progressbar")).not.toBeInTheDocument();
  },
};

export const ShutdownCounting: Story = {
  name: "Shutdown — countdown",
  render: renderPort({ reason: "shutdown", graceMs: 3_000 }, 500),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: /the anchor is down/i }),
    ).toBeVisible();
    await expect(canvas.getByText(/ringing the bell in \d+s/i)).toBeVisible();
    await expect(canvas.getByRole("progressbar")).toBeVisible();
  },
};

export const ShutdownWaiting: Story = {
  name: "Shutdown — waiting for the port",
  render: renderPort({ reason: "shutdown", graceMs: 3_000 }, 6_000),
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/the port is still silent/i)).toBeVisible();
  },
};

/**
 * Nothing announced (a plain disconnect landed here by mistake): the screen
 * falls back to the restart copy with no countdown left, i.e. the waiting state.
 */
export const NoNoticeFallback: Story = {
  name: "No notice — fallback copy",
  render: renderPort(undefined, 0),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: /the ship is entering port/i }),
    ).toBeVisible();
    await expect(canvas.queryByRole("progressbar")).not.toBeInTheDocument();
  },
};
