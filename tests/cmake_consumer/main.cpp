#include "fenrua/p521/field_element.hpp"

int main() {
    const auto sum = fenrua::p521::add(
        fenrua::p521::FieldElement::one(),
        fenrua::p521::FieldElement::one());
    return sum.is_zero() ? 1 : 0;
}
