import type { Meta, StoryObj } from "@storybook/react-vite";
import { DecoratedContainer } from "../DecoratedContainer";

const meta = {
  title: "components/DecoratedContainer",
  component: DecoratedContainer,
  tags: ["autodocs"],
  args: {
    header: "Create new game",
    children: (
      <>
        <p>Choose a room name and invite a rival to battle.</p>
        <button type="button">Join the battle</button>
      </>
    ),
  },
  decorators: [
    (Decorator) => {
      return (
        <div style={{ minWidth: "640px" }}>
          <Decorator />
        </div>
      );
    },
  ],
} satisfies Meta<typeof DecoratedContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutHeader: Story = {
  args: {
    header: undefined,
    children: <p>Content without a decorated heading.</p>,
  },
};

export const CustomContainer: Story = {
  args: {
    header: "Fleet status",
    containerClassName: "fleet-status",
    children: (
      <>
        <strong>3 ships remaining</strong>
        <p>Your fleet is ready for battle.</p>
      </>
    ),
  },
};
