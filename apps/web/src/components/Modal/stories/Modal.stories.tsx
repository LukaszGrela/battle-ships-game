import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Modal } from "../Modal";
import { useDisclosure } from "../../../utils/useDisclosure";
import { Button } from "../../Button";
import { Swords } from "../../icons";

const meta = {
  component: Modal,
  tags: ["autodocs"],
  args: {
    open: true,
    title: "Battle result",
    children: "You sank the enemy fleet.",
    onClose: fn(),
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Modal",
    open: false,
  },
  render: (props) => {
    const { isOpen, open, close } = useDisclosure(false);
    return (
      <div className="controller">
        <Button onClick={open}>Open modal</Button>
        <Modal {...props} open={isOpen} onClose={close}></Modal>
      </div>
    );
  },
};

export const Footer: Story = {
  args: {
    title: "Modal with footer",
    open: false,
    footer: (_, onClose) => (
      <>
        <Button type="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </>
    ),
  },
  render: (props) => {
    const { isOpen, open, close } = useDisclosure(false);
    return (
      <div className="controller">
        <Button onClick={open}>Open</Button>
        <Modal {...props} open={isOpen} onClose={close}></Modal>
      </div>
    );
  },
};

export const Icon: Story = {
  args: {
    title: "Modal with header icon",
    open: false,
    icon: <Swords />,
  },
  render: (props) => {
    const { isOpen, open, close } = useDisclosure(false);
    return (
      <div className="controller">
        <Button onClick={open}>Open</Button>
        <Modal {...props} open={isOpen} onClose={close}></Modal>
      </div>
    );
  },
};
