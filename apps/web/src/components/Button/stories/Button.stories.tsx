import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";
import { Button } from "../Button";
import { BotIcon } from "../../icons/BotIcon";

const TYPES = ["primary", "secondary", "info", "danger"] as const;

const SIZES = ["sm", "md", "lg"] as const;

const meta = {
  title: "components/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: { type: "radio" },
      options: [undefined, ...TYPES],
    },
    size: {
      control: { type: "radio" },
      options: [undefined, ...SIZES],
    },
  },
  args: {
    children: "Fire!",
    onClick: fn(),
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { type: "primary" },
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole("button", { name: "Fire!" });
    await userEvent.click(button);
    await expect(button).toBeEnabled();
  },
};

export const Secondary: Story = {
  args: { type: "secondary", children: "Cancel" },
};

export const WithIcon: Story = {
  args: {
    type: "secondary",
    children: (
      <>
        <BotIcon />
        <span>Create Bot Game</span>
      </>
    ),
  },
};

export const Disabled: Story = {
  args: { type: "danger", disabled: true, children: "Surrender" },
};

export const Sizes: Story = {
  name: "Size",
  render: (args) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      {SIZES.map((size) => (
        <div
          key={size}
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          {TYPES.map((type) => (
            <Button key={type} {...args} size={size} type={type}>
              {(type === "secondary" || type === "info") && <BotIcon />}
              <span>{size}</span>
            </Button>
          ))}
        </div>
      ))}
    </div>
  ),
};
