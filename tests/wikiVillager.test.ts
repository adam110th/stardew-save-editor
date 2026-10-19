import { describe, expect, it } from "vitest";
import { wikiToText } from "../codegen/wikiVillager";

describe("wiki text", () => {
	it("leaves no HTML tags behind, even nested ones", () => {
		expect(wikiToText("a <scr<b>ipt>alert(1)</script> b")).toBe("a alert(1) b");
		expect(wikiToText("x < y")).toBe("x y");
	});

	it("keeps the price from a price template", () => {
		expect(
			wikiToText(
				'purchasing "Bus" for {{Price|40000}} through the [[Joja Community Development Form]].',
			),
		).toBe(
			'purchasing "Bus" for 40,000g through the Joja Community Development Form.',
		);
		expect(wikiToText("{{price|1,500}} each")).toBe("1,500g each");
	});

	it("strips nested templates and formatting", () => {
		expect(wikiToText("A {{a|{{b}}}} ''b'' [[c]] [[d|e]]")).toBe("A b c e");
	});
});
