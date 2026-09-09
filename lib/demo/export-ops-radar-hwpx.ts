import { HwpxWriter } from "hwp-convert";

export async function buildOpsRadarHwpx(title: string, text: string): Promise<Uint8Array> {
  const writer = new HwpxWriter();
  return writer.createFromPlainText(`${title}\n\n${text}`, { title, creator: "Ops Radar" });
}
