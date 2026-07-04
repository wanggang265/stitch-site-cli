import assert from "node:assert";
import { describe, it } from "node:test";
import { toPascalCase, toRouteName } from "../utils.js";

describe("utils", () => {
  it("converts strings to PascalCase", () => {
    assert.equal(toPascalCase("hello world"), "HelloWorld");
    assert.equal(toPascalCase("my-page"), "MyPage");
    assert.equal(toPascalCase("already_pascal"), "AlreadyPascal");
  });

  it("converts strings to route names", () => {
    assert.equal(toRouteName("About Us"), "about-us");
    assert.equal(toRouteName("Contact_Page"), "contact-page");
    assert.equal(toRouteName("home"), "home");
  });
});
