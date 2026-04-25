// ============================================
// المزامنة في الوقت الفعلي
// ============================================

const Realtime = {
  channel: null,

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
      }, async () => {
        await Items.load();
        Locations.render();
        if (State.currentLocationId) Locations.renderItems();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'locations',
        filter: `family_id=eq.${State.family.id}`,
      }, async () => {
        await Locations.load();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'family_members',
        filter: `family_id=eq.${State.family.id}`,
      }, async () => {
        await Family.loadMembers();
        Family.renderFamilyPage();
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
