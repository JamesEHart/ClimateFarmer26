/**
 * Tech level computation for the three technology tracks.
 *
 * Each track maps a set of mutually-exclusive flag choices to a numeric level (0-3).
 * Different specific techs at the same tier → same level → same downstream eligibility.
 * This is the "reconvergence" design: content authoring scales linearly, not exponentially.
 */

export type TechTrack = 'water' | 'soil' | 'crop';

export function getTechLevel(flags: Record<string, boolean>, track: TechTrack): number {
  switch (track) {
    case 'water':
      if (flags.tech_ai_irrigation) return 3;
      if (flags.tech_water_recycling || flags.tech_advanced_irrigation) return 2;
      if (flags.tech_drip_irrigation || flags.tech_smart_irrigation
          || flags.tech_deficit_irrigation) return 1;
      return 0;
    case 'soil':
      if (flags.tech_precision_nutrients || flags.tech_organic_cert) return 3;
      if (flags.tech_vra || flags.tech_drone_mapping) return 2;
      if (flags.tech_soil_testing || flags.tech_extension_reports) return 1;
      return 0;
    case 'crop': {
      let count = 0;
      if (flags.tech_crop_agave) count++;
      if (flags.tech_crop_avocado) count++;
      if (flags.tech_crop_grapes) count++;
      return Math.min(count, 2);
    }
  }
}
