import { fireEvent, render, screen, within } from "@testing-library/react";
import Home from "@/app/page";

describe("Kanban board", () => {
  it("renders board with columns and initial cards", () => {
    render(<Home />);
    expect(screen.getByText("Kanban Board MVP")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Por hacer")).toBeInTheDocument();
    expect(screen.getByText("Diseñar esquema")).toBeInTheDocument();
  });

  it("allows adding a new card into a column", () => {
    render(<Home />);

    const todoColumn = screen.getByTestId("column-todo");
    expect(todoColumn).toBeInTheDocument();

    const titleInput =
      within(todoColumn).getByPlaceholderText("Título tarjeta");
    const detailsInput = within(todoColumn).getByPlaceholderText("Detalles");
    const addButton = within(todoColumn).getByRole("button", {
      name: "Agregar tarjeta",
    });

    fireEvent.change(titleInput, { target: { value: "Nueva tarea" } });
    fireEvent.change(detailsInput, { target: { value: "Descripción" } });
    fireEvent.click(addButton);

    expect(screen.getByText("Nueva tarea")).toBeInTheDocument();
  });

  it("allows deleting a card from a column", () => {
    render(<Home />);

    expect(screen.getByText("Diseñar esquema")).toBeInTheDocument();

    const deleteButton = screen.getByLabelText("Eliminar Diseñar esquema");
    fireEvent.click(deleteButton);

    expect(screen.queryByText("Diseñar esquema")).not.toBeInTheDocument();
  });
});
