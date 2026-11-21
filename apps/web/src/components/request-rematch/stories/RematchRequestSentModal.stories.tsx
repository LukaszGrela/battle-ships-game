import type { TRematchRequest } from "@repo/types";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { RematchRequestSentModal } from "../RematchRequestSentModal";
import { useDisclosure } from "../../../utils/useDisclosure";
import { useEffect } from "react";
import { Button } from "../../Button";

const pendingRequest: TRematchRequest = {
  requestId: "rematch-2",
  requestorId: "user-self",
  name: "Captain Morgan",
  seed: 7,
  status: "pending",
  expiresAt: new Date(Date.now() + 90_000).toISOString(),
};

const meta = {
  title: "components/RematchRequestSentModal",
  component: RematchRequestSentModal,
  tags: ["autodocs"],
  args: {
    open: true,
    request: pendingRequest,
  },
  argTypes: {
    open: { control: "boolean" },
    request: { control: "object" },
  },
} satisfies Meta<typeof RematchRequestSentModal>;

export default meta;
type Story = StoryObj<typeof meta>;
/**
 * **Note:** Modal will auto close after 10s.
 */
export const Pending: Story = {
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

    const request = {
      ...props.request,
      requestId: `${props.request?.requestId}:${Date.now()}`,
      expiresAt: new Date(Date.now() + 10_000).toISOString(),
    } as TRematchRequest;

    return (
      <div className="controller">
        <Button onClick={open}>Open Pending modal</Button>
        <RematchRequestSentModal {...props} request={request} open={isOpen} />
      </div>
    );
  },
};
/**
 * **Note:** Modal will auto close after 10s.
 */
export const CancelledByPlayer: Story = {
  args: {
    request: {
      ...pendingRequest,
      requestId: "rematch-cancelled-by-player",
      status: "cancelled",
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

    // to be able to open each time, make different requests
    const request = {
      ...props.request,
      requestId: `${props.request?.requestId}:${Date.now()}`,
    } as TRematchRequest;

    return (
      <div className="controller">
        <Button onClick={open} disabled={isOpen}>
          Open Canceled by player modal
        </Button>
        <RematchRequestSentModal {...props} request={request} open={isOpen} />
      </div>
    );
  },
};
/**
 * **Note:** Modal will auto close after 10s.
 */
export const CancelledByTimeout: Story = {
  args: {
    request: {
      ...pendingRequest,
      requestId: "rematch-cancelled-by-timeout",
      status: "cancelled",
      cancelledReason: "timeout",
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

    // to be able to open each time, make different requests
    const request = {
      ...props.request,
      requestId: `${props.request?.requestId}:${Date.now()}`,
    } as TRematchRequest;

    return (
      <div className="controller">
        <Button onClick={open} disabled={isOpen}>
          Open Cancel by timeout modal
        </Button>
        <RematchRequestSentModal {...props} request={request} open={isOpen} />
      </div>
    );
  },
};
