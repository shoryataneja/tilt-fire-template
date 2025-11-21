import { StatusBar } from "expo-status-bar";
import { TouchableWithoutFeedback } from "react-native";
import { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions, Text } from "react-native";
import { Accelerometer } from "expo-sensors";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const PLAYER_WIDTH = 50;
const PLAYER_HEIGHT = 50;
const BULLET_WIDTH = 10;
const BULLET_HEIGHT = 20;
const BLOCK_WIDTH = 40;
const BLOCK_HEIGHT = 40;

export default function App() {
  const [playerX, setPlayerX] = useState((screenWidth - PLAYER_WIDTH) / 2);
  const [bullets, setBullets] = useState([]);
  const [enemies, setEnemies] = useState([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  // Refs to keep the latest arrays for the fast game loop (avoid stale closures)
  const bulletsRef = useRef([]);
  const enemiesRef = useRef([]);
  const playerXRef = useRef(playerX);

  // Keep refs in-sync when states change
  useEffect(() => {
    bulletsRef.current = bullets;
  }, [bullets]);
  useEffect(() => {
    enemiesRef.current = enemies;
  }, [enemies]);
  useEffect(() => {
    playerXRef.current = playerX;
  }, [playerX]);

  // Accelerometer movement
  useEffect(() => {
    Accelerometer.setUpdateInterval(16);
    const subscription = Accelerometer.addListener(({ x }) => {
      if (gameOver) return;
      const move = x * 20;
      setPlayerX((prevX) => {
        const newX = prevX + move;
        const minX = 0;
        const maxX = screenWidth - PLAYER_WIDTH;
        return Math.max(minX, Math.min(newX, maxX));
      });
    });

    return () => subscription.remove();
  }, [gameOver]);

  // Spawn enemies every 1 second
  useEffect(() => {
    if (gameOver) return;
    const spawn = setInterval(() => {
      const enemy = {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        x: Math.random() * (screenWidth - BLOCK_WIDTH),
        y: -BLOCK_HEIGHT, // start just above the screen
      };
      // update both state and ref
      enemiesRef.current = [...enemiesRef.current, enemy];
      setEnemies(enemiesRef.current);
    }, 1000);

    return () => clearInterval(spawn);
  }, [gameOver]);

  // Main game loop: move bullets & enemies, check collisions
  useEffect(() => {
    if (gameOver) return;

    const tick = setInterval(() => {
      // Read current lists from refs
      const prevBullets = bulletsRef.current;
      const prevEnemies = enemiesRef.current;

      // Move bullets up
      const movedBullets = prevBullets
        .map((b) => ({ ...b, y: Math.round(b.y - 10) }))
        .filter((b) => b.y > -BULLET_HEIGHT);

      // Move enemies down
      const movedEnemies = prevEnemies
        .map((e) => ({ ...e, y: Math.round(e.y + 5) }))
        .filter((e) => e.y < screenHeight + BLOCK_HEIGHT);

      // Collision detection: bullets vs enemies
      const remainingBullets = [];
      const remainingEnemies = [...movedEnemies];
      let hits = 0;

      for (let b of movedBullets) {
        let hit = false;
        for (let i = 0; i < remainingEnemies.length; i++) {
          const e = remainingEnemies[i];
          const collided =
            b.x < e.x + BLOCK_WIDTH &&
            b.x + BULLET_WIDTH > e.x &&
            b.y < e.y + BLOCK_HEIGHT &&
            b.y + BULLET_HEIGHT > e.y;

          if (collided) {
            // remove that enemy
            remainingEnemies.splice(i, 1);
            hit = true;
            hits++;
            break;
          }
        }
        if (!hit) remainingBullets.push(b);
      }

      // Player collision with any enemy -> game over
      const playerTop = screenHeight - PLAYER_HEIGHT - 20;
      let playerHit = false;
      for (let e of remainingEnemies) {
        const collidedWithPlayer =
          e.x < playerXRef.current + PLAYER_WIDTH &&
          e.x + BLOCK_WIDTH > playerXRef.current &&
          e.y + BLOCK_HEIGHT > playerTop;
        if (collidedWithPlayer) {
          playerHit = true;
          break;
        }
      }

      if (playerHit) {
        // stop the game and clear game objects
        bulletsRef.current = [];
        enemiesRef.current = [];
        setBullets([]);
        setEnemies([]);
        setGameOver(true);
        return;
      }

      // commit updates to refs + state
      bulletsRef.current = remainingBullets;
      enemiesRef.current = remainingEnemies;
      setBullets(remainingBullets);
      setEnemies(remainingEnemies);

      if (hits > 0) setScore((s) => s + hits);
    }, 16);

    return () => clearInterval(tick);
  }, [gameOver]);

  // Shoot bullet (or restart if game over)
  const handlePress = () => {
    if (gameOver) {
      restartGame();
      return;
    }

    const newBullet = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      x: playerX + (PLAYER_WIDTH - BULLET_WIDTH) / 2,
      y: screenHeight - PLAYER_HEIGHT - 40,
    };

    bulletsRef.current = [...bulletsRef.current, newBullet];
    setBullets(bulletsRef.current);
  };

  const restartGame = () => {
    bulletsRef.current = [];
    enemiesRef.current = [];
    setBullets([]);
    setEnemies([]);
    setScore(0);
    setGameOver(false);
    // playerX stays where it is (or we can reset it)
    setPlayerX((screenWidth - PLAYER_WIDTH) / 2);
  };

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <View style={styles.container}>
        <Text style={styles.score}>Score: {score}</Text>

        {/* Player */}
        <View style={[styles.player, { left: playerX }]} />

        {/* Bullets */}
        {bullets.map((b) => (
          <View
            key={b.id}
            style={[styles.bullet, { left: Math.round(b.x), top: Math.round(b.y) }]}
          />
        ))}

        {/* Enemies */}
        {enemies.map((e) => (
          <View
            key={e.id}
            style={[styles.enemy, { left: Math.round(e.x), top: Math.round(e.y) }]}
          />
        ))}

        {gameOver && <Text style={styles.gameOver}>GAME OVER{'\n'}Tap to Restart</Text>}

        <StatusBar style="light" />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  player: {
    position: "absolute",
    bottom: 20,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    backgroundColor: "#FFF",
  },
  bullet: {
    position: "absolute",
    width: BULLET_WIDTH,
    height: BULLET_HEIGHT,
    backgroundColor: "#FFF",
  },
  enemy: {
    position: "absolute",
    width: BLOCK_WIDTH,
    height: BLOCK_HEIGHT,
    backgroundColor: "red",
  },
  score: {
    position: "absolute",
    top: 40,
    left: 20,
    fontSize: 22,
    color: "#FFF",
    fontFamily: "Courier",
  },
  gameOver: {
    position: "absolute",
    top: screenHeight / 2 - 40,
    width: "100%",
    textAlign: "center",
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
  },
});
