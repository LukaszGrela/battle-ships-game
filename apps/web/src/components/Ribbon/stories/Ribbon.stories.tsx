import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import { expect } from "storybook/test";
import { Ribbon } from "../Ribbon";
import { Flag, Swords } from "../../icons";
import { RibbonConfigurator } from "./RibbonConfigurator";
import { background } from "storybook/theming";

const meta = {
  component: Ribbon,
  tags: ["autodocs"],
  args: {
    children: "Ahoy, Captain!",
  },
} satisfies Meta<typeof Ribbon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithFoldChildren: Story = {
  args: {
    children: "Player",
    ribbonFoldLeftChildren: (
      <div style={{ flex: "0 0 auto" }}>
        <Swords />
      </div>
    ),
    ribbonFoldRightChildren: (
      <div>
        <Flag />
      </div>
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Player")).toBeVisible();
  },
};
export const RibbonConfiguratorStory: Story = {
  decorators: [
    (Story, context) => {
      const isDocs = context.viewMode === "docs";
      return (
        <div
          style={{
            background: "var(--pirates-background)",
            minHeight: isDocs ? "100%" : "calc(100vh - 4rem)",
            width: isDocs ? "100%" : "calc(100vw - 4rem)",
            padding: isDocs ? "0.5rem" : "2rem",
            boxSizing: "border-box",
          }}
        >
          <Story />
        </div>
      );
    },
  ],
  render: () => <RibbonConfigurator />,
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "RibbonConfigurator" }),
    ).toBeVisible();
  },
};
