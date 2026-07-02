/**
 * SwipeableRow — glissement gauche pour révéler les boutons d'action.
 *
 * Utilise marginLeft (propriété de layout) plutôt que translateX (visuel seulement).
 * En React Native, transform ne déplace PAS la hitbox — seules les propriétés de
 * layout le font. useNativeDriver: false est donc obligatoire ici.
 */
import { Animated, PanResponder, Pressable, Text, View } from "react-native";
import { useRef } from "react";
import { t } from "../../lib/i18n";

const BTN_W = 77;
const REVEAL = BTN_W * 2; // 154 px

interface SwipeableRowProps {
  children: React.ReactNode;
  onRegenerate: () => void;
  onRemove: () => void;
}

export function SwipeableRow({ children, onRegenerate, onRemove }: SwipeableRowProps) {
  // marginLeft anime la position de layout → hitbox ET rendu se déplacent ensemble
  const marginLeft = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(false);

  const snap = (toValue: number, open: boolean) => {
    Animated.spring(marginLeft, {
      toValue,
      useNativeDriver: false, // obligatoire : marginLeft est une prop de layout
      tension: 45,
      friction: 9,
    }).start();
    isOpenRef.current = open;
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 4 && Math.abs(dx) > Math.abs(dy),
      onPanResponderGrant: () => marginLeft.stopAnimation(),
      onPanResponderMove: (_, { dx }) => {
        const base = isOpenRef.current ? -REVEAL : 0;
        marginLeft.setValue(Math.min(0, Math.max(-REVEAL, base + dx)));
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        const base = isOpenRef.current ? -REVEAL : 0;
        const cur = base + dx;
        if (vx < -0.4 || cur < -REVEAL / 2) snap(-REVEAL, true);
        else snap(0, false);
      },
      onPanResponderTerminate: () => snap(0, false),
    })
  ).current;

  return (
    <View
      {...panResponder.panHandlers}
      style={{ marginHorizontal: 20, marginBottom: 12, borderRadius: 22, overflow: "hidden" }}
    >
      {/* Boutons fixes à droite — toujours à leur position JS, jamais déplacés */}
      <View
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: REVEAL,
          flexDirection: "row",
        }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "#F59E0B",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
          }}
          onPress={() => {
            snap(0, false);
            setTimeout(onRegenerate, 200);
          }}
          accessibilityRole="button"
          accessibilityLabel={t("meal.regenBtn")}
        >
          <Text style={{ color: "#fff", fontSize: 20 }}>↺</Text>
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
            {t("meal.regenBtn")}
          </Text>
        </Pressable>
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "#EF4444",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
          }}
          onPress={() => {
            snap(0, false);
            setTimeout(onRemove, 200);
          }}
          accessibilityRole="button"
          accessibilityLabel={t("meal.removeBtn")}
        >
          <Text style={{ color: "#fff", fontSize: 20 }}>✕</Text>
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
            {t("meal.removeBtn")}
          </Text>
        </Pressable>
      </View>

      {/*
        Carte animée via marginLeft.
        width: "100%" garantit que la carte garde sa largeur même avec marginLeft négatif.
        Quand marginLeft = -REVEAL : carte à x = -REVEAL…W-REVEAL,
        le container (overflow:hidden) expose les boutons à x = W-REVEAL…W,
        et la hitbox JS de la carte ne couvre plus cette zone → boutons touchables.
      */}
      <Animated.View style={{ marginLeft, width: "100%" }}>
        {children}
      </Animated.View>
    </View>
  );
}
