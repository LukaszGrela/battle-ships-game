import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn } from "storybook/test";
import { RoomNameInput } from "../RoomNameInput";

const STATUSES = ["idle", "invalid", "valid", "taken", "pending"] as const;

const meta = {
  title: "components/RoomNameInput",
  component: RoomNameInput,
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: "select",
      options: STATUSES,
    },
  },
  args: {
    status: "idle",
    value: "",
    onChange: fn(),
  },
} satisfies Meta<typeof RoomNameInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value);

    return (
      <RoomNameInput
        {...args}
        value={value}
        onChange={(event) => {
          args.onChange(event);
          setValue(event.target.value);
        }}
      />
    );
  },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole("textbox", { name: /room name/i });
    await userEvent.type(input, "Gulf-Broadside");
    await expect(input).toHaveValue("Gulf-Broadside");
    await expect(args.onChange).toHaveBeenCalled();
  },
};

export const Invalid: Story = {
  args: { status: "invalid", value: "A" },
};

export const Pending: Story = {
  args: { status: "pending", value: "Gulf-Broadside" },
};

export const Valid: Story = {
  args: { status: "valid", value: "Gulf-Broadside" },
};

export const Taken: Story = {
  args: { status: "taken", value: "Gulf-Broadside" },
};
