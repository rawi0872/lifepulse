import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Link, Stack } from "expo-router";
import { colors, spacing, radii } from "../lib/theme";
export default function RealmsScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title:"Realms", headerStyle:{backgroundColor:colors.bg}, headerTintColor:colors.textPrimary }} />
      <Text style={styles.title}>Life Realms</Text>
      <Link href="/body" asChild><TouchableOpacity style={styles.card}><Text style={styles.cardTitle}>Body</Text><Text style={styles.note}>Fitness, sleep, health</Text></TouchableOpacity></Link>
      <Link href="/wealth" asChild><TouchableOpacity style={styles.card}><Text style={styles.cardTitle}>Wealth</Text><Text style={styles.note}>Accounts, net worth, cash flow</Text></TouchableOpacity></Link>
      <Link href="/(tabs)/today" asChild><TouchableOpacity style={styles.link}><Text style={styles.linkText}>Back to Today</Text></TouchableOpacity></Link>
    </View>
  );
}
const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:colors.bg,padding:spacing.xl,paddingTop:56},
  title:{fontSize:26,fontWeight:"700",color:colors.textPrimary},
  card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radii.lg,padding:spacing.lg,marginTop:spacing.lg},
  cardTitle:{fontSize:15,fontWeight:"700",color:colors.textPrimary}, note:{fontSize:12,color:colors.textSecondary,marginTop:4},
  link:{marginTop:16,alignItems:"center"}, linkText:{color:colors.accent}
});
