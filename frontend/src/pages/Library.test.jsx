import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Library from "./Library";
import { api } from "@/lib/api";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-router-dom", () => ({
  Link: ({ to, ...props }) => require("react").createElement("a", { href: to, ...props }, props.children),
}));

jest.mock("@/lib/api", () => ({
  api: {
    get: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
  },
  formatApiError: jest.fn(),
}));

jest.mock("@/components/LibraryCard", () => ({
  LibraryCard: ({ s, onDelete }) => (
    <button data-testid="test-delete-story" onClick={onDelete}>{s.title}</button>
  ),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const story = {
  id: "story-1",
  title: "El cuento de prueba",
  idea: "Una historia para verificar el borrado.",
  genre: "fantasy",
  status: "done",
  favorite: false,
};

describe("Library deletion confirmation", () => {
  let container;
  let root;

  beforeEach(async () => {
    api.get.mockResolvedValue({ data: [story] });
    api.delete.mockResolvedValue({});
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<Library />);
      await Promise.resolve();
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  const click = async (selector) => {
    await act(async () => {
      document.querySelector(selector).click();
      await Promise.resolve();
    });
  };

  test("canceling the dialog keeps the story and does not call the API", async () => {
    await click('[data-testid="test-delete-story"]');
    expect(document.body.textContent).toContain("¿Borrar «El cuento de prueba»?");

    await click('[data-testid="library-delete-cancel"]');

    expect(api.delete).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("¿Borrar «El cuento de prueba»?");
    expect(container.textContent).toContain("El cuento de prueba");
  });

  test("confirming the dialog deletes the selected story", async () => {
    await click('[data-testid="test-delete-story"]');
    await click('[data-testid="library-delete-confirm"]');

    expect(api.delete).toHaveBeenCalledWith("/stories/story-1");
    expect(container.textContent).not.toContain("El cuento de prueba");
  });
});
