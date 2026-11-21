import type { TRematchRequest } from "@repo/types";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConfirmRematchModal } from "../ConfirmRematchModal";
import { Button } from "../../Button";
import { useDisclosure } from "../../../utils/useDisclosure";
import { useEffect } from "react";

const request: TRematchRequest = {
  requestId: "rematch-1",
  requestorId: "user-enemy",
  name: "Blackbeard",
  seed: 21,
  status: "pending",
};

const meta = {
  title: "components/ConfirmRematchModal",
  component: ConfirmRematchModal,
  tags: ["autodocs"],
  args: {
    open: true,
    request,
  },
  argTypes: {
    open: { control: "boolean" },
    request: { control: "object" },
  },
} satisfies Meta<typeof ConfirmRematchModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Challenge: Story = {
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
        <Button onClick={open}>Open Challange modal</Button>
        <ConfirmRematchModal {...props} open={isOpen} />
      </div>
    );
  },
};

export const UnknownChallenger: Story = {
  args: {
    request: undefined,
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
        <Button onClick={open}>Open Unknown Challenger modal</Button>
        <ConfirmRematchModal {...props} open={isOpen} />
      </div>
    );
  },
};
