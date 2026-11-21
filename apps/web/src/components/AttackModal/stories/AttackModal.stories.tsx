import type { Meta, StoryObj } from "@storybook/react-vite";
import { AttackModal } from "../AttackModal";
import { useDisclosure } from "../../../utils/useDisclosure";
import { Button } from "../../Button";

const meta = {
  title: "components/AttackModal",
  component: AttackModal,
  tags: ["autodocs"],
  args: {
    currentAttack: true,
    result: null,
    shipSize: 3,
  },
  argTypes: {
    result: {
      control: "select",
      options: [0, 101, 1001],
      labels: {
        0: "Miss",
        101: "Hit",
        1001: "Ship destroyed",
      },
    },
    shipSize: {
      control: { type: "range", min: 1, max: 5, step: 1 },
    },
  },
} satisfies Meta<typeof AttackModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: false,
    onClose: () => {},
    result: 0,
  },
  render: (props) => {
    const { isOpen, open, close } = useDisclosure(false);
    return (
      <div className="controller">
        <Button onClick={open}>Open Attack result Modal</Button>
        <AttackModal {...props} open={isOpen} onClose={close}></AttackModal>
      </div>
    );
  },
};

export const Miss: Story = {
  args: {
    open: false,
    onClose: () => {},
    result: 0,
  },
  render: (props) => {
    const { isOpen, open, close } = useDisclosure(false);
    return (
      <div className="controller">
        <Button onClick={open}>Open Missed result</Button>
        <AttackModal {...props} open={isOpen} onClose={close}></AttackModal>
      </div>
    );
  },
};

export const Hit: Story = {
  args: {
    open: false,
    onClose: () => {},
    result: 101,
  },
  render: (props) => {
    const { isOpen, open, close } = useDisclosure(false);
    return (
      <div className="controller">
        <Button onClick={open}>Open Hit result</Button>
        <AttackModal {...props} open={isOpen} onClose={close}></AttackModal>
      </div>
    );
  },
};

export const ShipDestroyed: Story = {
  args: {
    open: false,
    onClose: () => {},
    result: 1001,
    shipSize: 3,
  },
  render: (props) => {
    const { isOpen, open, close } = useDisclosure(false);
    return (
      <div className="controller">
        <Button onClick={open}>Open Destroyed result</Button>
        <AttackModal {...props} open={isOpen} onClose={close}></AttackModal>
      </div>
    );
  },
};

export const EnemyAttack: Story = {
  args: {
    open: false,
    onClose: () => {},
    currentAttack: false,
    result: 101,
  },
  render: (props) => {
    const { isOpen, open, close } = useDisclosure(false);
    return (
      <div className="controller">
        <Button onClick={open}>Open Enemy hit result</Button>
        <AttackModal {...props} open={isOpen} onClose={close}></AttackModal>
      </div>
    );
  },
};
