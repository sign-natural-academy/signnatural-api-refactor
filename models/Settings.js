// models/Settings.js
import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema(
  {
    siteName: { type: String, trim: true, default: 'Sign Natural Academy' },          // 1
    contactEmail: { type: String, trim: true },                                       // 2
    contactPhone: { type: String, trim: true },                                       // 3
    address: { type: String, trim: true },                                            // 4

    logoUrl: { type: String, trim: true },                                            // 5
    logoPublicId: { type: String, trim: true },                                       // 6

    privacyPolicyUrl: { type: String, trim: true },                                   // 7
    refundPolicyUrl: { type: String, trim: true },                                    // 8
    termsUrl: { type: String, trim: true },                                           // 9

    socials: {
      facebook: { type: String, trim: true },
      instagram: { type: String, trim: true },
      youtube: { type: String, trim: true },
      tiktok: { type: String, trim: true },
    },                                                                                // 10
  },
  { timestamps: true }                                                                // 11
);

// Ensure we only ever keep a single Settings doc (optional enforcement helper)
SettingsSchema.statics.getSingleton = async function () {                             // 12
  const existing = await this.findOne({});
  if (existing) return existing;
  return this.create({});
};

const Settings = mongoose.model('Settings', SettingsSchema);
export default Settings;
