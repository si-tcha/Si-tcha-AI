const fs = require('fs');
const path = '/home/qwerty/PROJETS/si-tcha-ai-mobile/frontend/src/app/(seller)/growth-log.tsx';
let content = fs.readFileSync(path, 'utf8');

const newStyles = `const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center' },
  container: { flex: 1, width: CONTAINER_WIDTH, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.four, backgroundColor: '#0F172A', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#F8FAFC' },
  headerSubtitle: { fontSize: 13, color: '#94A3B8', marginTop: 4 },
  addNavButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#0EA5E9', alignItems: 'center', justifyContent: 'center', shadowColor: '#0284C7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  scrollContent: { padding: Spacing.four, paddingBottom: 100 },
  alertBanner: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 20, padding: Spacing.four, marginBottom: Spacing.four, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  alertTitle: { fontSize: 14, fontWeight: '800', color: '#B91C1C' },
  alertBody: { fontSize: 13, color: '#991B1B', lineHeight: 20, marginBottom: 14 },
  alertAction: { flexDirection: 'row', backgroundColor: '#DC2626', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, alignSelf: 'flex-start', alignItems: 'center', shadowColor: '#DC2626', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  alertActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  actionButton: { flexDirection: 'row', backgroundColor: '#0EA5E9', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.five, shadowColor: '#0284C7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  actionButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: Spacing.three, marginLeft: 4 },
  parcelCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: Spacing.four, marginBottom: Spacing.four, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
  parcelCardAlert: { borderColor: '#FCA5A5', backgroundColor: '#FFFAFA' },
  parcelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  parcelName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  stageBadge: { backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  stageBadgeText: { fontSize: 11, fontWeight: '800', color: '#166534' },
  parcelDetailsRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 16, marginBottom: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  detailCol: { alignItems: 'center' },
  detailLabel: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  detailVal: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  volumeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  volumeLabel: { fontSize: 14, color: '#334155', fontWeight: '600' },
  volumeVal: { fontSize: 15, fontWeight: '800', color: '#0EA5E9' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: Spacing.five, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.four },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#334155', marginTop: 16, marginBottom: 8, marginLeft: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: '#F8FAFC', marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: '#0EA5E9', borderColor: '#0284C7' },
  chipText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '800' },
  textInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16, fontSize: 15, color: '#0F172A' },
  modalSubmitButton: { backgroundColor: '#0F172A', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 24, marginBottom: 30, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  modalSubmitText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});`;

content = content.replace(/const styles = StyleSheet.create\({[\s\S]*?}\);/, newStyles);

content = content.replace(/color="#f3ecd8"/g, 'color="#F8FAFC"');
content = content.replace(/color="#d97834"/g, 'color="#0EA5E9"');
content = content.replace(/color="#101e0f"/g, 'color="#0F172A"');
content = content.replace(/color="#889e87"/g, 'color="#64748B"');
content = content.replace(/color="#ffffff"/g, 'color="#FFFFFF"');
content = content.replace(/color: '#15803d'/g, "color: '#166534'");

fs.writeFileSync(path, content);
console.log('growth-log.tsx updated');
