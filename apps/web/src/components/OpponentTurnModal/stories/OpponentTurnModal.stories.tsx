import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { useDisclosure } from "../../../utils/useDisclosure";
import { Button } from "../../Button";
import { OpponentTurnModal } from "../OpponentTurnModal";
import { useEffect } from "react";

const meta = {
  title: "components/OpponentTurnModal",
  component: OpponentTurnModal,
  tags: ["autodocs"],
  args: {
    player: {
      id: "opponent-1",
      name: "Blackbeard",
      seed: 42,
      active: true,
      ready: true,
    },
    rotateMs: 0,
  },
} satisfies Meta<typeof OpponentTurnModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * **Note:** Modal will auto close after 10s.
 */
export const Default: Story = {
  args: {
    open: false,
    onClose: () => {},
  },
  render: (props) => {
    const { isOpen, open, close } = useDisclosure(false);

    useEffect(() => {
      let timerId: ReturnType<typeof setTimeout> | number = -1;

      if (isOpen) {
        timerId = setTimeout(close, 10_000);
      }

      return () => {
        clearTimeout(timerId);
      };
    }, [isOpen, close]);

    return (
      <div className="controller">
        <Button onClick={open}>Show opponent turn</Button>
        <OpponentTurnModal {...props} open={isOpen} onClose={close} />
      </div>
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: /show opponent turn/i }),
    );
    await expect(canvas.getByRole("dialog")).toBeVisible();
    await expect(canvas.getByRole("heading")).toHaveTextContent(/blackbeard/i);
  },
};

/**
 * Showcase rotating messages, every 3s the message will change.
 * **Note:** Modal will auto close after 10s.
 */
export const RotatingMessages: Story = {
  args: {
    open: false,
    onClose: () => {},
    rotateMs: 3000,
    player: {
      id: "opponent-2",
      name: "Anne Bonny",
      seed: 7,
      active: true,
      ready: true,
    },
  },
  render: (props) => {
    const { isOpen, open, close } = useDisclosure(false);

    useEffect(() => {
      let timerId: ReturnType<typeof setTimeout> | number = -1;

      if (isOpen) {
        timerId = setTimeout(close, 10_000);
      }

      return () => {
        clearTimeout(timerId);
      };
    }, [isOpen, close]);

    return (
      <div className="controller">
        <Button onClick={open}>Show rotating opponent turn</Button>
        <OpponentTurnModal {...props} open={isOpen} onClose={close} />
      </div>
    );
  },
};
