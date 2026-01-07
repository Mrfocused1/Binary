export const UPGRADES = {
  // Health upgrade
  health: {
    id: 'health',
    name: 'Tough Skin',
    description: 'Increases max health by 20 and fully heals',
    icon: '❤️',
    maxLevel: 10,
    effect: (player, level) => {
      player.maxHealth += 20;
      player.health = player.maxHealth; // Fully heal when upgrading
    },
    getDescription: (level) => `+${20 * level} Max Health (Full Heal)`
  },

  // Slew Dem - spawn allies (no limit!)
  slewDem: {
    id: 'slewDem',
    name: 'Slew Dem',
    description: 'Call in allies to defend you from opps',
    icon: '👥',
    maxLevel: Infinity, // No limit - call as many as you want!
    isBeefOption: true, // Special option for beef situations
    effect: (player, level, state) => {
      // Spawn allies near player - handled by PlayingState
      if (state && state.spawnSlewDem) {
        state.spawnSlewDem(2 + level); // 3+ allies based on level
      }
    },
    getDescription: (level) => `Call ${2 + level} allies to help`
  },

  beefDampening: {
    id: 'beefDampening',
    name: 'Low Profile',
    description: 'Cools down beef by 50%',
    icon: '🕶️',
    maxLevel: 10,
    effect: (player, level, state) => {
      // Reduce current beef by 50%
      if (state && state.game && state.game.gameData) {
        state.game.gameData.beefLevel = state.game.gameData.beefLevel * 0.5;
      }
    },
    getDescription: (level) => `Beef -50%`
  },

  // Future weapon skills (not implemented yet)
  intimidate: {
    id: 'intimidate',
    name: 'Intimidate',
    description: 'Scare opps away from your stash',
    icon: '😤',
    maxLevel: 5,
    isWeapon: true,
    effect: (player, level) => {
      // TODO: Implement weapon system
    },
    getDescription: (level) => `Level ${level} Intimidate`
  }
};

// Helper function to get random upgrades
export function getRandomUpgrades(count = 3, playerUpgrades = {}, includeBeefOptions = false) {
  const availableUpgrades = Object.values(UPGRADES).filter(upgrade => {
    // Filter out weapons
    if (upgrade.isWeapon) return false;
    // Filter out beef-only options unless requested
    if (upgrade.isBeefOption && !includeBeefOptions) return false;

    // Check if upgrade is maxed out
    const currentLevel = playerUpgrades[upgrade.id] || 0;
    return currentLevel < upgrade.maxLevel;
  });

  // Shuffle and pick
  const shuffled = [...availableUpgrades].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// Get upgrades for beef situation (always includes Slew Dem)
export function getBeefUpgrades(count = 3, playerUpgrades = {}) {
  const upgrades = getRandomUpgrades(count - 1, playerUpgrades, false);

  // Always add Slew Dem (no limit!)
  upgrades.unshift(UPGRADES.slewDem); // Put Slew Dem first

  return upgrades.slice(0, count);
}

// Get upgrade by ID
export function getUpgrade(id) {
  return UPGRADES[id];
}