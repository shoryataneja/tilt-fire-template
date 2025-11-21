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

  // Refs to keep real-time data
  const bulletsRef = useRef([]);
  const enemiesRef = useRef([]);
  const playerXRef = useRef(playerX);

  // Keep refs updated
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

  // Spawn new enemies every second
  useEffect(() => {
    if (gameOver) return;

    const spawn = setInterval(() => {
      const enemy = {
        id: Date.now().toString(),
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

      // ---- ENEMY MOVEMENT + BOTTOM COLLISION ----

      // Move enemies downward
      const movedEnemies = prevEnemies.map((e) => ({
        ...e,
        y: e.y + 5,
      }));

      // If ANY enemy hits the bottom → GAME OVER
      for (let e of movedEnemies) {
        const bottom = screenHeight - 20;

        if (e.y + BLOCK_HEIGHT >= bottom) {
          bulletsRef.current = [];
          enemiesRef.current = [];
          setBullets([]);
          setEnemies([]);
          setGameOver(true);
          return;
        }
      }

      // Cleanup: keep enemies only if inside screen
      const filteredEnemies = movedEnemies.filter(
        (e) => e.y < screenHeight + BLOCK_HEIGHT
      );

      // ---- BULLET → ENEMY COLLISION ----
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
            remainingEnemies.splice(i, 1);
            hits++;
            hit = true;
            break;
          }
        }

        if (!hit) remainingBullets.push(b);
      }

      // ---- PLAYER COLLISION WITH ENEMY ----
      const playerTop = screenHeight - PLAYER_HEIGHT - 20;

      for (let e of remainingEnemies) {
        const collided =
          e.x < playerXRef.current + PLAYER_WIDTH &&
          e.x + BLOCK_WIDTH > playerXRef.current &&
          e.y + BLOCK_HEIGHT > playerTop;

        if (collided) {
          bulletsRef.current = [];
          enemiesRef.current = [];
          setBullets([]);
          setEnemies([]);
          setGameOver(true);
          return;
        }
      }

      // ---- COMMIT UPDATES ----
      bulletsRef.current = remainingBullets;
      enemiesRef.current = remainingEnemies;

      setBullets(remainingBullets);
      setEnemies(remainingEnemies);

      if (hits > 0) setScore((s) => s + hits);
    }, 16);

    return () => clearInterval(tick);
  }, [gameOver]);

  // Shoot bullet / Restart
  const handlePress = () => {
    if (gameOver) {
      restartGame();
      return;
    }

    const bullet = {
      id: Date.now().toString(),
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

        {/* Player */}
        <View style={[styles.player, { left: playerX }]} />

        {/* Bullets */}
        {bullets.map((b) => (
          <View
            key={b.id}
            style={[styles.bullet, { left: b.x, top: b.y }]}
          />
        ))}

        {/* Enemies */}
        {enemies.map((e) => (
          <View
            key={e.id}
            style={[styles.enemy, { left: e.x, top: e.y }]}
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
    top: 75,
    left: 20,
    fontSize: 24,
    color: "#00E5FF",
    textShadowColor: "#00E5FF",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
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
