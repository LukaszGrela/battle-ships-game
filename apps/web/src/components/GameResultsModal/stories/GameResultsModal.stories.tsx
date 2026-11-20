import type { TGameState } from "@repo/types";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { useDisclosure } from "../../../utils/useDisclosure";
import { useGameStore } from "../../../store/useGameStore";
import { Button } from "../../Button";
import { GameResultsModal } from "../GameResultsModal";

const finishedGame: TGameState & { phase: "finished" } = {
  id: "storybook-room",
  name: "The Golden Cove",
  game_created: null,
  game_started: null,
  game_finished: "2024-04-01T12:00:00.000Z",
  turn: "captain",
  phase: "finished",
  result: { captain: "win", rival: "lost" },
  myBoard: [],
  self: {
    id: "captain",
    name: "Captain",
    seed: 1,
    active: true,
    ready: true,
    owner: true,
  },
  enemy: {
    id: "rival",
    name: "Rival",
    seed: 2,
    active: true,
    ready: true,
  },
  enemyBoard: [],
  enemyDestroyedShips: [],
  ships: [],
};

const GameResultsModalStory = ({ gameState }: { gameState: TGameState }) => {
  const { isOpen, open, close } = useDisclosure(false);

  useEffect(() => {
    const previousState = useGameStore.getState();
    useGameStore.setState({ gameState, selfId: gameState.self.id });

    return () => {
      useGameStore.setState({
        gameState: previousState.gameState,
        selfId: previousState.selfId,
      });
    };
  }, [gameState]);

  return (
    <div className="controller">
      <Button onClick={open}>Show game result</Button>
      <GameResultsModal gameState={gameState} open={isOpen} onClose={close} />
    </div>
  );
};

const meta = {
  title: "components/GameResultsModal",
  component: GameResultsModal,
  tags: ["autodocs"],
  args: {
    gameState: finishedGame,
  },
  render: (args) => <GameResultsModalStory gameState={args.gameState} />,
} satisfies Meta<typeof GameResultsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Victory: Story = { args: { open: false } };

export const Defeat: Story = {
  args: {
    open: false,
    gameState: {
      ...finishedGame,
      result: { captain: "lost", rival: "win" },
    },
  },
};
