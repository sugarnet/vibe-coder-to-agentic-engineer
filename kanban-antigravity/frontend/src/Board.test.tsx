import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { Board } from "./components/Board";

describe("Kanban Board MVP", () => {
  it("renders the kanban board with default columns", () => {
    render(<Board />);
    expect(screen.getByText("Kanban")).toBeInTheDocument();
    
    // Check if initial columns are present
    expect(screen.getByDisplayValue("To Do")).toBeInTheDocument();
    expect(screen.getByDisplayValue("In Progress")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Done")).toBeInTheDocument();
  });

  it("can rename a column", () => {
    render(<Board />);
    const todoColumn = screen.getByDisplayValue("To Do");
    fireEvent.change(todoColumn, { target: { value: "A Hacer" } });
    expect(screen.getByDisplayValue("A Hacer")).toBeInTheDocument();
  });
});
