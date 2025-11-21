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
const STARTING_LIVES = 3;

export default function App() {
  const [lives, setLives] = useState(STARTING_LIVES);
  const [playerX, setPlayerX] = useState((screenWidth - PLAYER_WIDTH) / 2);
  const [bullets, setBullets] = useState([]);
  const [enemies, setEnemies] = useState([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  // Refs for real-time updates inside game loop
  const livesRef = useRef(lives);
  const bulletsRef = useRef([]);
  const enemiesRef = useRef([]);
  const playerXRef = useRef(playerX);

  // Sync refs when states change
  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);

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

  // Spawn enemies every second
  useEffect(() => {
    if (gameOver) return;

    const spawn = setInterval(() => {
      const enemy = {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        x: Math.random() * (screenWidth - BLOCK_WIDTH),
        y: -BLOCK_HEIGHT,
      };

      enemiesRef.current = [...enemiesRef.current, enemy];
      setEnemies(enemiesRef.current);
    }, 1000);

    return () => clearInterval(spawn);
  }, [gameOver]);

  // Main game loop
  useEffect(() => {
    if (gameOver) return;

    const tick = setInterval(() => {
      const prevBullets = bulletsRef.current;
      const prevEnemies = enemiesRef.current;

      // Move bullets upward
      const movedBullets = prevBullets
        .map((b) => ({ ...b, y: b.y - 10 }))
        .filter((b) => b.y > -BULLET_HEIGHT);

      // Move enemies downward
      const movedEnemies = prevEnemies.map((e) => ({
        ...e,
        y: e.y + 5,
      }));

      // CHECK: any enemy reached bottom -> lose a life
      for (let e of movedEnemies) {
        const bottomLimit = screenHeight - 20; // floor level where player stands

        if (e.y + BLOCK_HEIGHT >= bottomLimit) {
          // Lose a life
          const newLives = Math.max(0, livesRef.current - 1);
          livesRef.current = newLives;
          setLives(newLives);

          // Clear bullets and enemies to give player a breather (unless game over)
          bulletsRef.current = [];
          enemiesRef.current = [];
          setBullets([]);
          setEnemies([]);

          if (newLives <= 0) {
            setGameOver(true);
          }
          // Stop processing this tick (we handled the event)
          return;
        }
      }

      // Cleanup: keep enemies only if inside screen
      const filteredEnemies = movedEnemies.filter(
        (e) => e.y < screenHeight + BLOCK_HEIGHT
      );

      // BULLET <-> ENEMY collision
      const remainingBullets = [];
      const remainingEnemies = [...filteredEnemies];
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
            hits++;
            hit = true;
            break;
          }
        }

        if (!hit) remainingBullets.push(b);
      }

      // PLAYER collision with enemy -> lose a life
      const playerTop = screenHeight - PLAYER_HEIGHT - 20;
      for (let e of remainingEnemies) {
        const collidedWithPlayer =
          e.x < playerXRef.current + PLAYER_WIDTH &&
          e.x + BLOCK_WIDTH > playerXRef.current &&
          e.y + BLOCK_HEIGHT > playerTop;

        if (collidedWithPlayer) {
          const newLives = Math.max(0, livesRef.current - 1);
          livesRef.current = newLives;
          setLives(newLives);

          // clear bullets and enemies for a breather (or end if lives 0)
          bulletsRef.current = [];
          enemiesRef.current = [];
          setBullets([]);
          setEnemies([]);

          if (newLives <= 0) {
            setGameOver(true);
          }
          return;
        }
      }

      // Commit updates
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

    const bullet = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      x: playerX + (PLAYER_WIDTH - BULLET_WIDTH) / 2,
      y: screenHeight - PLAYER_HEIGHT - 40,
    };

    bulletsRef.current = [...bulletsRef.current, bullet];
    setBullets(bulletsRef.current);
  };

  const restartGame = () => {
    bulletsRef.current = [];
    enemiesRef.current = [];
    setBullets([]);
    setEnemies([]);
    setScore(0);
    setLives(STARTING_LIVES);
    livesRef.current = STARTING_LIVES;
    setGameOver(false);
    setPlayerX((screenWidth - PLAYER_WIDTH) / 2);
  };

  // Stars background
  const Stars = () => (
    <>
      {[...Array(30)].map((_, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: Math.random() * screenHeight,
            left: Math.random() * screenWidth,
            width: 2,
            height: 2,
            backgroundColor: "#00E5FF",
            borderRadius: 10,
            opacity: Math.random(),
          }}
        />
      ))}
    </>
  );

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <View style={styles.container}>
        <Stars />

        <Text style={styles.score}>Score: {score}</Text>
        <Text style={styles.lives}>Lives: {lives}</Text>

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

        {gameOver && (
          <Text style={styles.gameOver}>GAME OVER{"\n"}Tap to Restart</Text>
        )}

        <StatusBar style="light" />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#02010A",
  },

  player: {
    position: "absolute",
    bottom: 20,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    backgroundColor: "#00E5FF",
    borderRadius: 8,
    shadowColor: "#00E5FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
  },

  bullet: {
    position: "absolute",
    width: BULLET_WIDTH,
    height: BULLET_HEIGHT,
    backgroundColor: "#76FF03",
    borderRadius: 4,
    shadowColor: "#76FF03",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },

  enemy: {
    position: "absolute",
    width: BLOCK_WIDTH,
    height: BLOCK_HEIGHT,
    backgroundColor: "#FF1744",
    borderRadius: 6,
    shadowColor: "#FF1744",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 18,
  },

  score: {
    position: "absolute",
    top: 80,
    left: 20,
    fontSize: 24,
    color: "#00E5FF",
    textShadowColor: "#00E5FF",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },

  lives: {
    position: "absolute",
    top: 80,
    right: 20,
    fontSize: 24,
    color: "#FF4081",
    textShadowColor: "#FF4081",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
    fontFamily: "Courier",
  },

  gameOver: {
    position: "absolute",
    top: screenHeight / 2 - 40,
    width: "100%",
    textAlign: "center",
    color: "#FF1744",
    fontSize: 32,
    fontWeight: "bold",
    textShadowColor: "#FF1744",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
});
