use std::{
    any::{Any, TypeId},
    collections::HashMap,
};

/// Values shared by a grammar's rules for one parse call.
#[derive(Default)]
pub struct ParseState {
    values: HashMap<TypeId, Box<dyn Any>>,
}

impl ParseState {
    pub fn get<T: Any>(&self) -> Option<&T> {
        self.values.get(&TypeId::of::<T>())?.downcast_ref()
    }

    pub fn get_or_default<T: Any + Default>(&mut self) -> &mut T {
        self.values
            .entry(TypeId::of::<T>())
            .or_insert_with(|| Box::new(T::default()))
            .downcast_mut()
            .expect("parse state value has the requested type")
    }
}
