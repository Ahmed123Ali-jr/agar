// ============================================
// المزامنة في الوقت الفعلي — مع debounce لتجنب التحديثات المكررة
// ============================================

const Realtime = {
  channel: null,
  itemsTimer: null,
  locationsTimer: null,
  membersTimer: null,
  // وقت آخر تعديل محلي — نتجاهل realtime خلال هذه الفترة لتفادي العمل المزدوج
  lastLocalChange: 0,

  markLocalChange() {
    Realtime.lastLocalChange = Date.now();
  },

  isFresh() {
    return Date.now() - Realtime.lastLocalChange < 1500;
  },

  start() {
    if (Realtime.channel) Realtime.stop();
    if (!State.family) return;

    Realtime.channel = supabaseClient
      .channel('family-' + State.family.id)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'items',
        filter: `family_id=eq.${State.family.id}`,
      }, () => {
        if (Realtime.isFresh()) return;
        clearTimeout(Realtime.itemsTimer);
        Realtime.itemsTimer = setTimeout(async () => {
          await Items.load();
          Locations.render();
          if (State.currentLocationId) Locations.renderItems();
        }, 300);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'locations',
        filter: `family_id=eq.${State.family.id}`,
      }, () => {
        if (Realtime.isFresh()) return;
        clearTimeout(Realtime.locationsTimer);
        Realtime.locationsTimer = setTimeout(() => Locations.load(), 300);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'family_members',
        filter: `family_id=eq.${State.family.id}`,
      }, () => {
        clearTimeout(Realtime.membersTimer);
        Realtime.membersTimer = setTimeout(async () => {
          await Family.loadMembers();
          Family.renderFamilyPage();
        }, 300);
      })
      .subscribe();
  },

  stop() {
    if (Realtime.channel) {
      supabaseClient.removeChannel(Realtime.channel);
      Realtime.channel = null;
    }
  },
};
