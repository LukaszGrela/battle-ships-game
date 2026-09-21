import styles from "./SplashScreen.module.css";
import { Ribbon } from "../components/Ribbon/Ribbon";
import { useSocket } from "../socket";
import { Button } from "../components/Button/Button";
import { classNames } from "../utils/classNames";

export const SplashScreen = () => {
  const { connect } = useSocket();
  return (
    <section className={styles.SplashScreen}>
      <div className={styles.container}>
        <img
          alt="Pirates - BattleShips"
          src="./title.png"
          className={styles.logo}
        />
        <Button
          type="custom"
          onClick={connect}
          className={classNames(styles.connect, "shadow")}
        >
          <Ribbon className={styles.goldButton}>
            Connect to the Battleships Game server
          </Ribbon>
        </Button>
      </div>
    </section>
  );
};
