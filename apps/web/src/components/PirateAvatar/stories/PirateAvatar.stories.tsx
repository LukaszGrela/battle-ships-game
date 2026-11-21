import type { CSSProperties } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PirateAvatar } from "../PirateAvatar";

const meta = {
  title: "components/PirateAvatar",
  component: PirateAvatar,
  tags: ["autodocs"],
  args: {
    avatarIndex: 1,
    isBot: false,
  },
  argTypes: {
    avatarIndex: {
      control: { type: "range", min: 1, max: 48, step: 1 },
      description: "Avatar sprite index (1–48).",
    },
    isBot: {
      control: "boolean",
      description: "Uses the bot avatar sprites.",
    },
    className: { control: false },
    children: { control: false },
  },
} satisfies Meta<typeof PirateAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Bot: Story = {
  args: {
    isBot: true,
  },
};

export const CustomSize: Story = {
  decorators: [
    (Story) => (
      <div style={{ "--avatar-size": "128px" } as CSSProperties}>
        <Story />
      </div>
    ),
  ],
};

export const GalleryHuman: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: (args) => (
    <div
      style={
        {
          "--avatar-size": "64px",
          display: "grid",
          gridTemplateColumns: "repeat(8, 64px)",
          gap: "0.75rem",
        } as CSSProperties
      }
    >
      {Array.from({ length: 48 }, (_, index) => (
        <PirateAvatar key={index} {...args} avatarIndex={index + 1} />
      ))}
    </div>
  ),
};
export const GalleryBot: Story = {
  parameters: {
    controls: { disable: true },
  },
  args: {
    isBot: true,
  },
  render: (args) => (
    <div
      style={
        {
          "--avatar-size": "64px",
          display: "grid",
          gridTemplateColumns: "repeat(8, 64px)",
          gap: "0.75rem",
        } as CSSProperties
      }
    >
      {Array.from({ length: 48 }, (_, index) => (
        <PirateAvatar key={index} {...args} avatarIndex={index + 1} />
      ))}
    </div>
  ),
};
