// frontend/components/FinancialOnboarding.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, Alert, ScrollView, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const WEAKNESSES = [
  "Food Delivery", "Online Shopping", "Impulse Buys",
  "Gaming", "Gadgets", "Subscriptions",
  "Coffee", "Fashion", "Partying",
  "Travel", "Stress Spending", "Convenience"
];

const GOALS = [
  { id: "mindful_spending", icon: "🧘‍♂️", title: "Mindful Spending", desc: "Track expenses & reduce anxiety." },
  { id: "aggressive_savings", icon: "🚀", title: "Aggressive Savings", desc: "Maximize wealth & hit targets fast." },
  { id: "debt_payoff", icon: "⚔️", title: "Debt Payoff", desc: "Clear EMIs & credit card debt." },
  { id: "guilt_free", icon: "🍸", title: "Guilt-Free Lifestyle", desc: "Budget for fun without guilt." }
];

const TOTAL_STEPS = 4;

// --- Palette Constants ---
const COLORS = {
  primary: '#2E7D6E',     // Teal Green
  secondary: '#A7D7C5',   // Soft Mint
  background: '#F4F7F6',  // Background
  accent: '#FFC857',      // Warm Gold
  text: '#1F2933',        // Dark Text
  textMuted: 'rgba(31, 41, 51, 0.55)', // Muted Text
  white: '#FFFFFF',
  glass: 'rgba(255, 255, 255, 0.65)', // Glassy look
  glassBorder: 'rgba(255, 255, 255, 0.9)'
};

export default function FinancialOnboarding({ visible, onComplete }: { visible: boolean, onComplete: (data: any) => void }) {
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false); // New loading state

  // Form State
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [income, setIncome] = useState(30000);
  const [needs, setNeeds] = useState(15000);
  const [selectedWeakness, setSelectedWeakness] = useState<string[]>([]);

  if (!visible) return null;

  // --- Handlers ---
  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (step === 0 && !selectedGoal) {
      Alert.alert("Wait a sec!", "Please select a main objective so we can tailor your experience.");
      return;
    }

    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (isLoading) return; // Prevent going back while loading
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step > 0) setStep(step - 1);
  };

  const handleFinish = () => {
    setIsLoading(true);

    // Simulate a brief "processing" delay for a premium AI feel
    setTimeout(() => {
      onComplete({
        base_income: income,
        fixed_needs: needs,
        target_savings_goal: (income - needs) * 0.3,
        spending_weakness: selectedWeakness.join(', '),
        primary_goal: selectedGoal
      });
      setIsLoading(false); // Reset just in case the parent doesn't instantly unmount
    }, 1500);
  };

  const toggleWeakness = (item: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedWeakness(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const selectGoal = (goalId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGoal(goalId);
  };

  // --- Render Steps ---
  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.mainTitle}>What's your objective?</Text>
            <Text style={styles.mainSubtitle}>This defines how your coach operates.</Text>
            <View style={styles.goalContainer}>
              {GOALS.map((goal) => (
                <TouchableOpacity
                  key={goal.id}
                  style={[styles.goalCard, selectedGoal === goal.id && styles.goalCardActive]}
                  onPress={() => selectGoal(goal.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.goalIcon}>{goal.icon}</Text>
                  <View style={styles.goalTextContainer}>
                    <Text style={[styles.goalTitle, selectedGoal === goal.id && styles.goalTitleActive]}>
                      {goal.title}
                    </Text>
                    <Text style={[styles.goalDesc, selectedGoal === goal.id && styles.goalDescActive]}>
                      {goal.desc}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.mainTitle}>Monthly income?</Text>
            <Text style={styles.mainSubtitle}>Your baseline budget calculation.</Text>
            <View style={styles.sliderCard}>
              <Text style={styles.amount}>₹{income.toLocaleString()}</Text>
              <Slider
                style={styles.slider}
                minimumValue={10000} maximumValue={300000} step={5000}
                value={income} onValueChange={setIncome}
                minimumTrackTintColor={COLORS.primary}
                maximumTrackTintColor={'rgba(167, 215, 197, 0.4)'}
                thumbTintColor={COLORS.accent}
              />
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.mainTitle}>Fixed monthly bills?</Text>
            <Text style={styles.mainSubtitle}>Rent, utilities, EMIs, groceries.</Text>
            <View style={styles.sliderCard}>
              <Text style={styles.amount}>₹{needs.toLocaleString()}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0} maximumValue={income} step={1000}
                value={needs} onValueChange={setNeeds}
                minimumTrackTintColor={COLORS.primary}
                maximumTrackTintColor={'rgba(167, 215, 197, 0.4)'}
                thumbTintColor={COLORS.accent}
              />
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.mainTitle}>Your kryptonite.</Text>
            <Text style={styles.mainSubtitle}>What drains your wallet the fastest?</Text>
            <View style={styles.bubbleContainer}>
              {WEAKNESSES.map(w => (
                <TouchableOpacity
                  key={w}
                  style={[styles.bubble, selectedWeakness.includes(w) && styles.bubbleActive]}
                  onPress={() => toggleWeakness(w)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.bubbleText, selectedWeakness.includes(w) && styles.bubbleTextActive]}>
                    {w}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.fullScreenContainer}>
      <SafeAreaView style={styles.safeArea}>

        {/* Loading Overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Personalizing your coach...</Text>
          </View>
        )}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isLoading} // Disable scroll while loading
        >
          {/* Segmented Progress Bar (Flows with Scroll) */}
          <View style={styles.progressWrapper}>
            {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.progressSegment,
                  idx <= step ? styles.progressSegmentActive : styles.progressSegmentInactive
                ]}
              />
            ))}
          </View>

          <View style={styles.contentArea}>
            {renderStepContent()}
          </View>

          <View style={styles.footer}>
            {step > 0 ? (
              <TouchableOpacity style={styles.backBtn} onPress={handleBack} disabled={isLoading}>
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <TouchableOpacity
              style={[
                styles.nextBtn,
                (step === 0 && !selectedGoal) && styles.nextBtnDisabled,
                isLoading && styles.nextBtnDisabled
              ]}
              onPress={handleNext}
              disabled={isLoading || (step === 0 && !selectedGoal)}
            >
              <Text style={styles.nextBtnText}>
                {step === TOTAL_STEPS - 1 ? "Complete Setup" : "Continue"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    zIndex: 999
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background
  },

  // Loading Overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(244, 247, 246, 0.85)', // Slight blur over the background color
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  // Layout for ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40
  },

  // Segmented Progress Bar
  progressWrapper: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 4,
  },
  progressSegmentActive: {
    backgroundColor: COLORS.primary,
  },
  progressSegmentInactive: {
    backgroundColor: 'rgba(167, 215, 197, 0.3)', // Very subtle mint
  },

  contentArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepContainer: {
    flex: 1
  },

  // Minimal Typography
  mainTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3
  },
  mainSubtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    marginTop: 6,
    lineHeight: 22,
    fontWeight: '400'
  },

  // Glassy Rectangular Goal Cards
  goalContainer: {
    marginTop: 28,
    gap: 12
  },
  goalCard: {
    flexDirection: 'row',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 12, // More rectangular
    backgroundColor: COLORS.glass, // Faux glass effect
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
  },
  goalCardActive: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2
  },
  goalIcon: {
    fontSize: 24, // Scaled down slightly
    marginRight: 14
  },
  goalTextContainer: {
    flex: 1
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2
  },
  goalTitleActive: {
    color: COLORS.primary, // Subtle active color change, not a heavy block
  },
  goalDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18
  },
  goalDescActive: {
    color: 'rgba(46, 125, 110, 0.7)', // Tinted text when active
  },

  // Minimal Sliders
  sliderCard: {
    marginTop: 36,
    alignItems: 'center',
    backgroundColor: COLORS.glass,
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  amount: {
    fontSize: 34,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 24,
    letterSpacing: -0.5
  },
  slider: {
    width: width - 80,
    height: 40
  },

  // Minimal Weaknesses Bubbles
  bubbleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 28
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8, // Rectangular look
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  bubbleActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent
  },
  bubbleText: {
    color: COLORS.text,
    fontWeight: '500',
    fontSize: 14
  },
  bubbleTextActive: {
    color: COLORS.text, // Keep dark for contrast
    fontWeight: '600'
  },

  // Minimal Footer
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 40,
    marginBottom: 20,
    alignItems: 'center'
  },
  backBtn: {
    flex: 1,
    paddingVertical: 16
  },
  backBtnText: {
    color: COLORS.textMuted,
    fontSize: 15,
    fontWeight: '600'
  },
  nextBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: 16, // Slimmer button
    borderRadius: 12, // Matches the rectangular minimal theme
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4
  },
  nextBtnDisabled: {
    opacity: 0.5
  },
  nextBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700'
  }
});