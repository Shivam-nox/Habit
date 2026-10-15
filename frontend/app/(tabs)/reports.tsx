import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useApi } from '../../services/api';

const C = {
  brand: '#2E7D6E',
  bg: '#FAFAFA', surface: '#FFFFFF', text: '#111827',
  subtext: '#9CA3AF', border: '#EEEEEE', fill: '#F5F5F5',
  success: '#16A34A', danger: '#DC2626',
};

const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

export default function ReportsScreen() {
  const api = useApi();
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  
  const [targetDate, setTargetDate] = useState(new Date());

  const getMonthStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const displayMonth = targetDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const prevMonth = () => setTargetDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setTargetDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const handleGenerateReport = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsGenerating(true);
    try {
      const res = await api.getReportData?.(getMonthStr(targetDate)) || { data: null };
      if (res.data) {
        setReportData(res.data);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not generate report.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = async () => {
    if (!reportData) return Alert.alert('Generate first', 'Please generate a report before exporting.');

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { monthlyReport: m, budgetReport: b } = reportData;

    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111827; padding: 40px; }
            h1 { color: #2E7D6E; border-bottom: 1px solid #EEEEEE; padding-bottom: 10px; font-weight: 600; }
            h2 { color: #111827; margin-top: 30px; font-size: 16px; }
            .grid { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .box { background: #FAFAFA; padding: 15px; border-radius: 10px; width: 22%; text-align: center; border: 1px solid #EEEEEE; }
            .box span { display: block; font-size: 11px; color: #9CA3AF; text-transform: uppercase; margin-bottom: 5px; }
            .box strong { font-size: 18px; color: #111827; }
            .alert { background: #FAFAFA; padding: 15px; border-left: 3px solid #2E7D6E; margin-bottom: 10px; border-radius: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #EEEEEE; font-size: 13px; }
            th { color: #9CA3AF; text-transform: uppercase; font-size: 11px; }
            .over { color: #DC2626; font-weight: 600; }
            .under { color: #16A34A; font-weight: 600; }
          </style>
        </head>
        <body>
          <h1>Financial wrap-up: ${reportData.month}</h1>

          <h2>Monthly overview</h2>
          <div class="grid">
            <div class="box"><span>Income</span><strong>${fmt(m.income)}</strong></div>
            <div class="box"><span>Expenses</span><strong>${fmt(m.expenses)}</strong></div>
            <div class="box"><span>Savings</span><strong>${fmt(m.savings)}</strong></div>
            <div class="box"><span>Rate</span><strong>${m.savingsRate}%</strong></div>
          </div>

          <div class="alert">
            <strong>Reality check</strong><br/>
            <ul>${m.realityCheck.map((msg: string) => `<li>${msg}</li>`).join('')}</ul>
          </div>

          <h2>Budget control</h2>
          <p>Overall utilization: <strong>${b.overallUtilization}%</strong></p>
          <p>Top problem area: <strong class="over">${b.topProblemArea}</strong></p>

          <table>
            <tr><th>Category</th><th>Limit</th><th>Spent</th><th>Difference</th></tr>
            ${b.categories.map((cat: any) => `
              <tr>
                <td>${cat.name}</td>
                <td>${fmt(cat.limit)}</td>
                <td>${fmt(cat.spent)}</td>
                <td class="${cat.status}">${cat.status === 'over' ? '+' : ''}${fmt(cat.diff)}</td>
              </tr>
            `).join('')}
          </table>

          <div style="margin-top: 20px;">
            <strong>Insights</strong>
            <ul>${b.insights.map((msg: string) => `<li>${msg}</li>`).join('')}</ul>
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert('Error', 'Could not export PDF.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reports</Text>
        <TouchableOpacity style={[styles.exportBtn, !reportData && { opacity: 0.4 }]} onPress={handleExportPDF} disabled={!reportData}>
          <Feather name="download" size={14} color={C.brand} />
          <Text style={styles.exportText}>Export PDF</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }} style={styles.banner}>
          <MaterialCommunityIcons name="file-chart-outline" size={24} color={C.brand} style={{ marginBottom: 10 }} />
          <Text style={styles.bannerTitle}>Monthly & budget report</Text>
          <Text style={styles.bannerSub}>Compile a clean summary of your spending and budget discipline.</Text>

          <View style={styles.monthSelector}>
            <TouchableOpacity onPress={prevMonth} style={styles.monthBtn}>
              <Feather name="chevron-left" size={20} color={C.text} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{displayMonth}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.monthBtn}>
              <Feather name="chevron-right" size={20} color={C.text} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.generateBtn} onPress={handleGenerateReport} disabled={isGenerating} activeOpacity={0.7}>
            {isGenerating ? <ActivityIndicator size="small" color={C.surface} /> : (
              <>
                <Text style={styles.generateBtnText}>Generate for {displayMonth}</Text>
                <Feather name="arrow-right" size={15} color={C.surface} />
              </>
            )}
          </TouchableOpacity>
        </MotiView>

        {reportData ? (
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }} style={styles.reportCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBox}><Feather name="check" size={18} color={C.success} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reportDate}>{reportData.month} ready</Text>
                <Text style={styles.reportId}>Monthly overview + budgets</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.cardStats}>
              <View style={styles.statBlock}>
                <Text style={styles.statLabel}>Savings rate</Text>
                <Text style={styles.statValue}>{reportData.monthlyReport.savingsRate}%</Text>
              </View>
              <View style={styles.statBlock}>
                <Text style={styles.statLabel}>Budget used</Text>
                <Text style={[styles.statValue, { color: reportData.budgetReport.overallUtilization > 100 ? C.danger : C.text }]}>
                  {reportData.budgetReport.overallUtilization}%
                </Text>
              </View>
            </View>

            {reportData.monthlyReport.topCategories && reportData.monthlyReport.topCategories.length > 0 && (
              <View style={styles.topCatsContainer}>
                <Text style={styles.topCatsTitle}>Top Expenses</Text>
                {reportData.monthlyReport.topCategories.map((c: any, i: number) => (
                  <View key={i} style={styles.topCatRow}>
                    <Text style={styles.topCatName}>{c.name}</Text>
                    <View style={styles.topCatRight}>
                      <Text style={styles.topCatTotal}>{fmt(c.total)}</Text>
                      <Text style={styles.topCatPct}>{c.percent}%</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </MotiView>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="file-text" size={26} color={C.border} style={{ marginBottom: 8 }} />
            <Text style={styles.emptyText}>Tap generate above to compile your data.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: C.text, letterSpacing: -0.4 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: C.border },
  exportText: { fontSize: 12, fontWeight: '600', color: C.brand },
  banner: { backgroundColor: C.surface, borderRadius: 18, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  bannerTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 5 },
  bannerSub: { fontSize: 13, color: C.subtext, lineHeight: 19, marginBottom: 18 },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.brand, paddingVertical: 13, borderRadius: 14 },
  generateBtnText: { color: C.surface, fontSize: 14, fontWeight: '700' },
  reportCard: { backgroundColor: C.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' },
  reportDate: { fontSize: 15, fontWeight: '700', color: C.text },
  reportId: { fontSize: 12, color: C.subtext, marginTop: 2 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  cardStats: { flexDirection: 'row', justifyContent: 'space-between' },
  statBlock: { flex: 1 },
  statLabel: { fontSize: 11, color: C.subtext, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  statValue: { fontSize: 17, fontWeight: '700', color: C.text },
  emptyState: { padding: 32, alignItems: 'center', marginTop: 12 },
  emptyText: { fontSize: 13, color: C.subtext },
  monthSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.fill, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 16 },
  monthBtn: { padding: 8, backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  monthLabel: { fontSize: 15, fontWeight: '600', color: C.text },
  topCatsContainer: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderColor: C.border },
  topCatsTitle: { fontSize: 13, fontWeight: '600', color: C.subtext, textTransform: 'uppercase', marginBottom: 12 },
  topCatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  topCatName: { fontSize: 14, color: C.text, fontWeight: '500' },
  topCatRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topCatTotal: { fontSize: 14, fontWeight: '600', color: C.text },
  topCatPct: { fontSize: 12, color: C.subtext, width: 35, textAlign: 'right' }
});