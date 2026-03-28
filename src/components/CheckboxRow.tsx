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
    borderColor: "#8b9d97",
    backgroundColor: "#fbf8ef",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: "#10211d",
    borderColor: "#10211d",
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#f8f2e7",
  },
  checkboxLabel: {
    flex: 1,
    color: "#41534d",
    fontSize: 14,
    lineHeight: 21,
  },
});
