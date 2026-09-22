const fs = require('fs');
const path = '/home/qwerty/PROJETS/si-tcha-ai-mobile/frontend/src/app/(seller)/sync.tsx';
let content = fs.readFileSync(path, 'utf8');

const newStyles = `const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center' },
  container: { width: CONTAINER_WIDTH, height: '100%', backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
    backgroundColor: '#0F172A',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  iconBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#F8FAFC' },
  scroll: { padding: Spacing.four, gap: Spacing.four, paddingBottom: 100 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.four,
    gap: 12,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  body: { fontSize: 14, color: '#64748B', lineHeight: 20 },
  timeTag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  meta: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  roleBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0EA5E9',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  roleBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    paddingVertical: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  syncBtnDisabled: { opacity: 0.5 },
  syncBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  resultCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    padding: Spacing.four,
    gap: 12,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  resultMetricsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  metricItem: { alignItems: 'center' },
  metricVal: { fontSize: 24, fontWeight: '900', color: '#15803D' },
  metricSub: { fontSize: 12, color: '#166534', fontWeight: '600', marginTop: 4 },
});`;

content = content.replace(/const styles = StyleSheet.create\({[\s\S]*?}\);/, newStyles);

content = content.replace(/color="#f3ecd8"/g, 'color="#F8FAFC"');
content = content.replace(/color="#d97834"/g, 'color="#0EA5E9"');
content = content.replace(/color="#101e0f"/g, 'color="#0F172A"');
content = content.replace(/color="#889e87"/g, 'color="#64748B"');
content = content.replace(/color="#ffffff"/g, 'color="#FFFFFF"');
content = content.replace(/color: '#15803d'/g, "color: '#166534'");
content = content.replace(/color="#15803d"/g, 'color="#166534"');

fs.writeFileSync(path, content);
console.log('sync.tsx updated');
