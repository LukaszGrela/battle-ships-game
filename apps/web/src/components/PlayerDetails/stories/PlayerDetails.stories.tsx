import type { IPlayer } from "@repo/types";
import { EGamePhase } from "@repo/types";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PlayerDetails } from "../PlayerDetails";

const self: IPlayer = {
  id: "user-self",
  name: "Captain Thunderous Morgan",
  seed: 7,
  active: true,
  ready: true,
  owner: true,
};

const enemy: IPlayer = {
  id: "user-enemy",
  name: "Blackbeard Shattered Dog",
  seed: 21,
  active: true,
  ready: false,
};

const meta = {
  title: "components/PlayerDetails",
  component: PlayerDetails,
  tags: ["autodocs"],
  args: {
    self,
    enemy: false,
    phase: EGamePhase.Playing,
  },
  argTypes: {
    phase: {
      control: "select",
      options: Object.values(EGamePhase),
      description: "Current room phase, used for the readiness ribbon.",
    },
    enemy: { control: "boolean" },
    result: {
      control: "inline-radio",
      options: ["win", "lost"],
    },
    className: { control: false },
  },
} satisfies Meta<typeof PlayerDetails>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Owner: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 420, padding: "2rem 1rem 3rem" }}>
        <Story />
      </div>
    ),
  ],
};

export const Enemy: Story = {
  args: {
    self: enemy,
    enemy: true,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, padding: "2rem 1rem 3rem" }}>
        <Story />
      </div>
    ),
  ],
};

export const EnemyReady: Story = {
  args: {
    self: { ...enemy, ready: true },
    enemy: true,
    phase: EGamePhase.Placement,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, padding: "2rem 1rem 3rem" }}>
        <Story />
      </div>
    ),
  ],
};

export const EnemyLeft: Story = {
  args: {
    self: { ...enemy, active: false, ready: true },
    enemy: true,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, padding: "2rem 1rem 3rem" }}>
        <Story />
      </div>
    ),
  ],
};

export const BotOpponent: Story = {
  args: {
    self: {
      id: "bot-hard",
      name: "Ironbeard",
      seed: 33,
      active: true,
      ready: true,
      botLevel: "hard",
    },
    enemy: true,
    phase: EGamePhase.Playing,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, padding: "2rem 1rem 3rem" }}>
        <Story />
      </div>
    ),
  ],
};

export const BotSmallOpponent: Story = {
  parameters: {
    viewport: { defaultViewport: "iphone6" },
    docs: { story: { inline: false, height: "658px" } },
  },
  args: {
    self: {
      id: "bot-hard",
      name: "Ironbeard",
      seed: 33,
      active: true,
      ready: true,
      botLevel: "hard",
    },
    enemy: true,
    phase: EGamePhase.Playing,
  },
};

export const Loser: Story = {
  args: {
    result: "lost",
    phase: EGamePhase.Finished,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, padding: "2rem 1rem 3rem" }}>
        <Story />
      </div>
    ),
  ],
};

export const Winner: Story = {
  args: {
    result: "win",
    phase: EGamePhase.Finished,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, padding: "2rem 1rem 3rem" }}>
        <Story />
      </div>
    ),
  ],
};

export const GameHeader: Story = {
  args: {
    result: "win",
    phase: EGamePhase.Finished,
  },
  render: (args, context) => {
    const isDocs = context.viewMode === "docs";
    return (
      <div
        style={{
          display: "flex",
          gap: "1rem",
          background: "var(--pirates-background)",
          width: isDocs ? "100%" : "calc(100vw - 4rem)",
          padding: isDocs ? "0.5rem" : "0rem",
          boxSizing: "border-box",
        }}
      >
        <PlayerDetails {...args} />
        <PlayerDetails
          {...args}
          result="lost"
          self={{ ...enemy, active: false }}
          enemy
        />
      </div>
    );
  },
};

export const GameHeaderSmall: Story = {
  parameters: {
    viewport: { defaultViewport: "iphone6" },
    docs: { story: { inline: false, height: "658px" } },
  },
  args: {
    result: "win",
    phase: EGamePhase.Finished,
  },
  render: (args) => {
    return (
      <div
        style={{
          position: "relative",
          display: "flex",
          gap: "1rem",
          background: "var(--pirates-background)",
          width: "100vw",
          padding: "0rem",
          boxSizing: "border-box",
        }}
      >
        <PlayerDetails {...args} />
        <PlayerDetails
          {...args}
          result={undefined}
          phase={EGamePhase.Placement}

          self={{ ...enemy, active: true, ready: true, botLevel: "medium" }}
          enemy
        />
      </div>
    );
  },
};
