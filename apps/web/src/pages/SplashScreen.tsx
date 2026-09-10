import styles from "./SplashScreen.module.css";
import { Ribbon } from "../components/Ribbon/Ribbon";
import { useSocket } from "../socket";
import { Button } from "../components/Button/Button";

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
        <Button style="custom" onClick={connect} className={styles.connect}>
          <Ribbon className={styles.goldButton}>
            Connect to the Battleships Game server
          </Ribbon>
        </Button>
      </div>
    </section>
  );
};
