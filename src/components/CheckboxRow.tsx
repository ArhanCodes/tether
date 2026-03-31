import { Pressable, View, Text, StyleSheet } from "react-native";

export function CheckboxRow({
  checked,
  label,
  onPress,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.checkboxRow} onPress={onPress}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <View style={styles.checkboxInner} /> : null}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: "#1d4ed8",
    borderColor: "#1d4ed8",
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#ffffff",
  },
  checkboxLabel: {
    flex: 1,
    color: "#475569",
    fontSize: 14,
    lineHeight: 21,
  },
});
